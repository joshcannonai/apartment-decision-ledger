import { describe, expect, it } from "vitest";
import {
  normalizeRentCastListing,
  normalizeRentCastResponse,
  toExternalCandidate,
} from "../../api/_lib/rentcast";

describe("normalizeRentCastListing", () => {
  it("keeps useful listing facts while remaining truthful about missing media", () => {
    const item = normalizeRentCastListing(
      {
        id: "example",
        formattedAddress: "123 Main St, Denver, CO 80202",
        addressLine1: "123 Main St",
        city: "Denver",
        state: "co",
        latitude: 39.74,
        longitude: -104.99,
        bedrooms: 1,
        bathrooms: 1,
        squareFootage: 700,
        price: 1850,
        status: "Active",
      },
      "2026-08-31T12:00:00.000Z",
    );

    expect(item).toMatchObject({
      providerId: "example",
      city: "Denver",
      state: "CO",
      baseRent: 1850,
      source: { sourceUrl: null, mediaStatus: "unavailable" },
    });

    expect(toExternalCandidate(item!)).toMatchObject({
      id: "rentcast-example",
      allInEstimate: { low: null, high: null },
      unknowns: expect.arrayContaining(["Original public listing URL", "Exact-unit photos"]),
      source: { evidenceGrade: "B" },
    });
  });

  it("drops malformed records rather than inventing required facts", () => {
    expect(normalizeRentCastResponse([{ city: "Denver", state: "CO" }])).toEqual([]);
  });
});
