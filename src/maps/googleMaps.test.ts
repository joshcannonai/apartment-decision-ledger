import { describe, expect, it } from "vitest";
import { buildGoogleDiscoveryMapUrl, buildGoogleMapUrls } from "./googleMaps";

describe("buildGoogleMapUrls", () => {
  it("builds a keyless personal-list preview plus a standard Maps directions URL", () => {
    const urls = buildGoogleMapUrls({
      origin: "130 S 800 E, Salt Lake City, UT",
      destination: "Trader Joe's Salt Lake City",
    });

    expect(urls.embedMode).toBe("personal_list_fallback");
    expect(urls.embedUrl).toContain("maps.google.com/maps?output=embed");
    expect(urls.embedUrl).not.toContain("daddr=");
    expect(urls.openUrl).toContain("google.com/maps/dir/?api=1");
  });

  it("uses the official Embed API when a restricted browser key is configured", () => {
    const urls = buildGoogleMapUrls({
      origin: "40.76,-111.89",
      destination: "University of Utah",
      embedApiKey: "maps-key",
    });

    expect(urls.embedMode).toBe("official_api");
    expect(urls.embedUrl).toContain("/embed/v1/directions?key=maps-key");
  });

  it("starts wide and zooms into a selected city or neighborhood", () => {
    expect(buildGoogleDiscoveryMapUrl()).toContain("q=United%20States&z=3");
    expect(buildGoogleDiscoveryMapUrl("Central City, Salt Lake City, UT")).toContain(
      "q=Central%20City%2C%20Salt%20Lake%20City%2C%20UT&z=11",
    );
  });

  it("accepts a closer zoom for a neighborhood focus", () => {
    expect(buildGoogleDiscoveryMapUrl("Central City, Salt Lake City, UT", 14)).toContain(
      "q=Central%20City%2C%20Salt%20Lake%20City%2C%20UT&z=14",
    );
  });
});
