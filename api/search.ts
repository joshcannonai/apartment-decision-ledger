import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { readJsonBody, sendJson, type ApiRequest, type ApiResponse } from "./_lib/http.js";
import { normalizeRentCastResponse, toExternalCandidate } from "./_lib/rentcast.js";

type SearchInput = {
  city: string;
  state: string;
  bedrooms?: string;
  maxRent?: number;
  limit?: number;
};

const US_STATE = /^[A-Z]{2}$/;

function parseSearchInput(value: unknown): SearchInput {
  if (!value || typeof value !== "object") throw new Error("Search input must be an object");
  const body = value as Record<string, unknown>;
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  const bedrooms = typeof body.bedrooms === "string" ? body.bedrooms.trim() : undefined;
  const maxRent = typeof body.maxRent === "number" && Number.isFinite(body.maxRent) ? body.maxRent : undefined;
  const limit = typeof body.limit === "number" && Number.isInteger(body.limit)
    ? Math.min(Math.max(body.limit, 15), 500)
    : 200;

  if (city.length < 2 || city.length > 80) throw new Error("City must contain 2–80 characters");
  if (!US_STATE.test(state)) throw new Error("State must be a two-letter US abbreviation");
  if (bedrooms && !/^(?:0|[1-9]\d?)(?:-(?:0|[1-9]\d?))?$/.test(bedrooms)) {
    throw new Error("Bedrooms must be a number or numeric range");
  }
  if (maxRent !== undefined && (maxRent < 200 || maxRent > 100_000)) {
    throw new Error("Maximum rent is outside the supported range");
  }
  return { city, state, bedrooms, maxRent, limit };
}

function queryKey(input: SearchInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { ok: false, code: "method_not_allowed", message: "Use POST /api/search" });
    return;
  }

  if (process.env.ENABLE_LIVE_RENTCAST !== "true") {
    sendJson(res, 503, {
      ok: false,
      code: "live_provider_disabled",
      message: "Live nationwide search is not configured. The verified Salt Lake City demo remains available.",
      demoAvailable: true,
    });
    return;
  }

  const apiKey = process.env.RENTCAST_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!apiKey || !databaseUrl) {
    sendJson(res, 503, {
      ok: false,
      code: "provider_configuration_incomplete",
      message: "Live search requires both RentCast and database credentials so usage can be capped atomically.",
      demoAvailable: true,
    });
    return;
  }

  let input: SearchInput;
  try {
    input = parseSearchInput(await readJsonBody(req));
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      code: "invalid_search",
      message: error instanceof Error ? error.message : "Search input is invalid",
    });
    return;
  }

  const sql = neon(databaseUrl);
  const key = queryKey(input);
  const cached = await sql`
    SELECT payload, observed_at, expires_at
    FROM adl_search_cache
    WHERE query_key = ${key} AND expires_at > NOW()
    LIMIT 1
  `;
  if (cached.length) {
    sendJson(res, 200, {
      ok: true,
      mode: "live-cache",
      observedAt: cached[0].observed_at,
      candidates: cached[0].payload,
      photoStatus: "not_provided_by_rentcast",
    });
    return;
  }

  const configuredCap = Number(process.env.RENTCAST_MONTHLY_REQUEST_CAP || "45");
  const requestCap = Number.isInteger(configuredCap) ? Math.min(Math.max(configuredCap, 1), 49) : 45;
  const reservation = await sql`
    INSERT INTO adl_provider_usage (provider, period, call_count, spend_micros)
    VALUES ('rentcast', ${currentPeriod()}, 1, 0)
    ON CONFLICT (provider, period) DO UPDATE
    SET call_count = adl_provider_usage.call_count + 1,
        updated_at = NOW()
    WHERE adl_provider_usage.call_count < ${requestCap}
    RETURNING call_count
  `;
  if (!reservation.length) {
    sendJson(res, 429, {
      ok: false,
      code: "provider_budget_exhausted",
      message: "The monthly RentCast safety allocation is exhausted. Cached and demo results remain available.",
      demoAvailable: true,
    });
    return;
  }

  const url = new URL("https://api.rentcast.io/v1/listings/rental/long-term");
  url.searchParams.set("city", input.city);
  url.searchParams.set("state", input.state);
  url.searchParams.set("status", "Active");
  url.searchParams.set("limit", String(input.limit));
  if (input.bedrooms) url.searchParams.set("bedrooms", input.bedrooms);
  if (input.maxRent) url.searchParams.set("price", `0-${Math.round(input.maxRent)}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      sendJson(res, response.status >= 500 ? 502 : response.status, {
        ok: false,
        code: "rentcast_request_failed",
        message: `RentCast returned HTTP ${response.status}. The demo dataset remains available.`,
        demoAvailable: true,
      });
      return;
    }

    const observedAt = new Date().toISOString();
    const listings = normalizeRentCastResponse(await response.json(), observedAt);
    const candidates = listings.map(toExternalCandidate);
    const cacheMinutesRaw = Number(process.env.RENTCAST_CACHE_MINUTES || "30");
    const cacheMinutes = Number.isFinite(cacheMinutesRaw) ? Math.min(Math.max(cacheMinutesRaw, 5), 1_440) : 30;
    await sql`
      INSERT INTO adl_search_cache (query_key, provider, payload, observed_at, expires_at)
      VALUES (${key}, 'rentcast', ${JSON.stringify(candidates)}::jsonb, ${observedAt}, NOW() + (${cacheMinutes} * INTERVAL '1 minute'))
      ON CONFLICT (query_key) DO UPDATE
      SET payload = EXCLUDED.payload,
          observed_at = EXCLUDED.observed_at,
          expires_at = EXCLUDED.expires_at
    `;

    sendJson(res, 200, {
      ok: true,
      mode: "live",
      observedAt,
      candidates,
      photoStatus: "not_provided_by_rentcast",
      usage: { rentcastCallsThisPeriod: reservation[0].call_count, cap: requestCap },
    });
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      code: error instanceof Error && error.name === "AbortError" ? "provider_timeout" : "provider_error",
      message: "Live inventory could not be loaded. The verified demo remains available.",
      demoAvailable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}
