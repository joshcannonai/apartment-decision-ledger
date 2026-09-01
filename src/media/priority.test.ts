import { describe, expect, it } from "vitest";
import { shouldRequestMedia } from "./priority";

describe("progressive listing media priority", () => {
  it("requests the leading image before the rest of the shortlist", () => {
    expect(shouldRequestMedia({ phase: "lead", rank: 0, mediaIndex: 0, selected: true })).toBe(true);
    expect(shouldRequestMedia({ phase: "lead", rank: 1, mediaIndex: 0, selected: false })).toBe(false);
  });

  it("loads the first five heroes before the selected gallery", () => {
    expect(shouldRequestMedia({ phase: "shortlist", rank: 4, mediaIndex: 0, selected: false })).toBe(true);
    expect(shouldRequestMedia({ phase: "shortlist", rank: 0, mediaIndex: 1, selected: true })).toBe(false);
    expect(shouldRequestMedia({ phase: "gallery", rank: 0, mediaIndex: 3, selected: true })).toBe(true);
  });

  it("leaves lower-ranked heroes lazy until background loading", () => {
    expect(shouldRequestMedia({ phase: "gallery", rank: 8, mediaIndex: 0, selected: false })).toBe(false);
    expect(shouldRequestMedia({ phase: "background", rank: 8, mediaIndex: 0, selected: false })).toBe(true);
  });
});
