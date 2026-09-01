import type { DistanceEstimate, SearchAnchor } from "./types";

export const KNOWN_SLC_ANCHORS: Array<
  Omit<SearchAnchor, "id" | "source" | "confidence" | "status">
> = [
  {
    label: "Downtown Salt Lake City",
    latitude: 40.7644,
    longitude: -111.891,
    importance: 3,
    verification: "verified_coordinates",
  },
  {
    label: "Trader Joe's Salt Lake City",
    latitude: 40.754,
    longitude: -111.873,
    importance: 3,
    verification: "verified_coordinates",
  },
  {
    label: "Salt Lake Central Station",
    latitude: 40.7617,
    longitude: -111.908,
    importance: 3,
    verification: "verified_coordinates",
  },
  {
    label: "University of Utah",
    latitude: 40.7649,
    longitude: -111.8421,
    importance: 3,
    verification: "verified_coordinates",
  },
  {
    label: "Liberty Park",
    latitude: 40.7456,
    longitude: -111.8749,
    importance: 3,
    verification: "verified_coordinates",
  },
];

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function straightLineMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateDistance(
  latitude: number | null,
  longitude: number | null,
  anchor: SearchAnchor,
): DistanceEstimate {
  if (
    latitude == null ||
    longitude == null ||
    anchor.latitude == null ||
    anchor.longitude == null
  ) {
    return {
      anchorId: anchor.id,
      anchorLabel: anchor.label,
      straightLineMiles: null,
      estimatedDriveMinutes: null,
      status: "needs_coordinates",
    };
  }

  const miles = straightLineMiles(latitude, longitude, anchor.latitude, anchor.longitude);
  return {
    anchorId: anchor.id,
    anchorLabel: anchor.label,
    straightLineMiles: Number(miles.toFixed(1)),
    estimatedDriveMinutes: Math.max(3, Math.round(3 + miles * 3.2)),
    status: "estimated",
  };
}

export function resolveKnownAnchor(label: string) {
  const normalized = label.toLowerCase();
  return KNOWN_SLC_ANCHORS.find((anchor) => {
    const candidate = anchor.label.toLowerCase();
    return candidate.includes(normalized) || normalized.includes(candidate.split(" salt lake")[0]);
  });
}
