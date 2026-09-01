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
  it("places a known floor plan fourth when at least three photos exist", () => {
    const ordered = orderCandidateMedia([
      item("hero"),
      item("kitchen"),
      item("bedroom"),
      item("bathroom"),
      item("floor", "floor_plan"),
    ]);
    expect(ordered.map((media) => media.alt)).toEqual([
      "hero",
      "kitchen",
      "bedroom",
      "floor",
      "bathroom",
    ]);
  });

  it("keeps ordinary photo order unchanged", () => {
    const media = [item("hero"), item("kitchen")];
    expect(orderCandidateMedia(media)).toEqual(media);
  });
});
