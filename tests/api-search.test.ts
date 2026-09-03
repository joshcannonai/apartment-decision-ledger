import { afterEach, describe, expect, it } from "vitest";
import handler from "../api/search.js";
import type { ApiRequest, ApiResponse } from "../api/_lib/http.js";

function responseHarness() {
  const headers = new Map<string, string>();
  let body = "";
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    end(value?: string) {
      body = value || "";
      return this;
    },
  } as unknown as ApiResponse;

  return {
    response,
    result: () => ({
      status: response.statusCode,
      headers,
      body: JSON.parse(body) as Record<string, unknown>,
    }),
  };
}

afterEach(() => {
  delete process.env.ENABLE_LIVE_RENTCAST;
  delete process.env.RENTCAST_API_KEY;
  delete process.env.DATABASE_URL;
});

describe("POST /api/search", () => {
  it("keeps the deterministic demo available when live search is disabled", async () => {
    const harness = responseHarness();
    await handler({ method: "POST", body: { city: "Denver", state: "CO" } } as ApiRequest, harness.response);

    expect(harness.result()).toMatchObject({
      status: 503,
      body: { code: "live_provider_disabled", demoAvailable: true },
    });
  });

  it("does not expose the search route through other methods", async () => {
    const harness = responseHarness();
    await handler({ method: "GET" } as ApiRequest, harness.response);

    expect(harness.result()).toMatchObject({
      status: 405,
      body: { code: "method_not_allowed" },
    });
  });
});
