export type RentCastListing = {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  status?: string;
  price?: number;
  listedDate?: string;
  lastSeenDate?: string;
  daysOnMarket?: number;
  mlsName?: string;
  mlsNumber?: string;
};

export type NormalizedRentCastListing = {
  providerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  yearBuilt: number | null;
  baseRent: number;
  listingStatus: string;
  listedAt: string | null;
  observedAt: string;
  daysOnMarket: number | null;
  source: {
    provider: "rentcast";
    label: string;
    externalId: string | null;
    sourceUrl: null;
    mediaStatus: "unavailable";
  };
};

export type ExternalApartmentCandidate = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  baseRent: number;
  allInEstimate: { low: null; high: null; note: string };
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  availability: string;
  features: string[];
  unknowns: string[];
  source: {
    url: string;
    label: string;
    observedAt: string;
    evidenceGrade: "B";
    note: string;
  };
};

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function normalizeRentCastListing(
  raw: RentCastListing,
  observedAt = new Date().toISOString(),
): NormalizedRentCastListing | null {
  const address = raw.formattedAddress?.trim();
  const city = raw.city?.trim();
  const state = raw.state?.trim().toUpperCase();
  const rent = finiteNumber(raw.price);
  if (!address || !city || !state || rent === null || rent <= 0) return null;

  const providerId = raw.id?.trim() || `${address}|${rent}`;
  return {
    providerId,
    name: raw.addressLine2?.trim() || raw.addressLine1?.trim() || address,
    address,
    city,
    state,
    zipCode: raw.zipCode?.trim() || null,
    latitude: finiteNumber(raw.latitude),
    longitude: finiteNumber(raw.longitude),
    propertyType: raw.propertyType?.trim() || null,
    bedrooms: finiteNumber(raw.bedrooms),
    bathrooms: finiteNumber(raw.bathrooms),
    squareFeet: finiteNumber(raw.squareFootage),
    yearBuilt: finiteNumber(raw.yearBuilt),
    baseRent: rent,
    listingStatus: raw.status?.trim() || "Unknown",
    listedAt: raw.listedDate || null,
    observedAt: raw.lastSeenDate || observedAt,
    daysOnMarket: finiteNumber(raw.daysOnMarket),
    source: {
      provider: "rentcast",
      label: raw.mlsName?.trim() || "RentCast rental listing record",
      externalId: raw.mlsNumber?.trim() || raw.id?.trim() || null,
      sourceUrl: null,
      mediaStatus: "unavailable",
    },
  };
}

export function normalizeRentCastResponse(
  value: unknown,
  observedAt = new Date().toISOString(),
): NormalizedRentCastListing[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeRentCastListing(item as RentCastListing, observedAt))
    .filter((item): item is NormalizedRentCastListing => item !== null);
}

export function toExternalCandidate(item: NormalizedRentCastListing): ExternalApartmentCandidate {
  const features = [
    item.propertyType,
    item.yearBuilt ? `Built ${item.yearBuilt}` : null,
  ].filter((value): value is string => Boolean(value));
  return {
    id: `rentcast-${item.providerId}`,
    name: item.name,
    address: item.address,
    city: item.city,
    state: item.state,
    neighborhood: item.zipCode ? `ZIP ${item.zipCode}` : "Neighborhood needs enrichment",
    latitude: item.latitude,
    longitude: item.longitude,
    baseRent: item.baseRent,
    allInEstimate: {
      low: null,
      high: null,
      note: "RentCast supplies listed rent; mandatory fees and utilities need source enrichment.",
    },
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    squareFeet: item.squareFeet,
    availability: item.listingStatus,
    features,
    unknowns: [
      "Estimated all-in monthly cost",
      "Original public listing URL",
      "Exact-unit photos",
      "Current lease terms",
    ],
    source: {
      url: "https://www.rentcast.io/",
      label: item.source.label,
      observedAt: item.observedAt,
      evidenceGrade: "B",
      note: "Normalized RentCast listing record; original listing URL and media are not provided by this endpoint.",
    },
  };
}
