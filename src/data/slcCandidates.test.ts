import { describe, expect, it } from "vitest";
import { orderCandidateMedia } from "../media/order";
import { SLC_DEMO_CANDIDATES } from "./slcCandidates";

describe("Salt Lake City demo media", () => {
  it("gives every visible demo listing its own lead image", () => {
    const leadImages = SLC_DEMO_CANDIDATES.map((candidate) =>
      orderCandidateMedia(candidate.media ?? [])[0]?.thumbnailUrl,
    );

    expect(leadImages.every(Boolean)).toBe(true);
    expect(new Set(leadImages).size).toBe(SLC_DEMO_CANDIDATES.length);
    expect(SLC_DEMO_CANDIDATES.every((candidate) => candidate.media?.length === 1)).toBe(true);
  });
});
