import { describe, expect, it } from "vitest";
import type { CandidateMedia } from "../domain/types";
import { orderCandidateMedia } from "./order";

function item(alt: string, kind: CandidateMedia["kind"] = "photo"): CandidateMedia {
  return {
    url: `https://example.com/${alt}.jpg`,
    thumbnailUrl: `https://example.com/${alt}-thumb.jpg`,
    alt,
    kind,
    scope: "exact_unit",
    sourceLabel: "Test source",
    sourceUrl: "https://example.com/listing",
    observedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("orderCandidateMedia", () => {
  it("leads with an informative kitchen-living overview and places a known floor plan fourth", () => {
    const ordered = orderCandidateMedia([
      item("hero"),
      item("kitchen opening into living room"),
      item("bedroom"),
      item("bathroom"),
      item("floor", "floor_plan"),
    ]);
    expect(ordered.map((media) => media.alt)).toEqual([
      "kitchen opening into living room",
      "hero",
      "bedroom",
      "floor",
      "bathroom",
    ]);
  });

  it("keeps equal-priority photos in their original order", () => {
    const media = [item("view one"), item("view two")];
    expect(orderCandidateMedia(media)).toEqual(media);
  });
});
