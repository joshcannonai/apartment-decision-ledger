export type LiveSearchRequest = {
  city: string;
  state: string;
  bedrooms?: string;
  maxRent?: number;
  limit?: number;
};

export type LiveSearchResponse = {
  ok: boolean;
  mode?: "live" | "live-cache";
  observedAt?: string;
  candidates?: unknown[];
  photoStatus?: "not_provided_by_rentcast";
  code?: string;
  message?: string;
  demoAvailable?: boolean;
};

export async function searchLiveInventory(
  input: LiveSearchRequest,
  signal?: AbortSignal,
): Promise<LiveSearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const payload = (await response.json()) as LiveSearchResponse;
  if (!response.ok && !payload.demoAvailable) {
    throw new Error(payload.message || `Live search failed (${response.status})`);
  }
  return payload;
}
