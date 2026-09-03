import { estimateDistance } from "./geo";
import type {
  ApartmentCandidate,
  CandidateScores,
  Preference,
  SearchAnchor,
  SortOption,
} from "./types";

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function activePreferences(preferences: Preference[]) {
  return preferences.filter((preference) => preference.status !== "rejected");
}

function activeAnchors(anchors: SearchAnchor[]) {
  return anchors.filter((anchor) => anchor.status !== "rejected");
}

export function scoreMarketValue(
  candidate: ApartmentCandidate,
  market: ApartmentCandidate[],
) {
  if (candidate.baseRent == null) {
    return {
      score: 20,
      estimatedFairBaseRent: null,
      percentBelowEstimate: null,
      comparableCount: 0,
      explanation: "No base rent was supplied, so market value cannot be calculated.",
      caveat: "Market Value is an estimate from this result set, not an appraisal or a live market census.",
    };
  }

  const comparables = market.filter(
    (item) =>
      item.id !== candidate.id &&
      item.baseRent != null &&
      item.bedrooms === candidate.bedrooms &&
      item.city.toLowerCase() === candidate.city.toLowerCase(),
  );
  const medianRent = median(comparables.map((item) => item.baseRent as number));
  const medianRentPerSquareFoot = median(
    comparables
      .filter((item) => item.squareFeet && item.squareFeet > 0)
      .map((item) => (item.baseRent as number) / (item.squareFeet as number)),
  );

  let fairRent = medianRent;
  if (medianRentPerSquareFoot != null && candidate.squareFeet != null && medianRent != null) {
    fairRent = medianRent * 0.45 + medianRentPerSquareFoot * candidate.squareFeet * 0.55;
  }

  if (fairRent == null) {
    return {
      score: 50,
      estimatedFairBaseRent: null,
      percentBelowEstimate: null,
      comparableCount: comparables.length,
      explanation: "There are not enough same-bedroom results to estimate a comparison price.",
      caveat: "Market Value is an estimate from this result set, not an appraisal or a live market census.",
    };
  }

  const percentBelowEstimate = ((fairRent - candidate.baseRent) / fairRent) * 100;
  const evidencePenalty =
    candidate.source.evidenceGrade === "A"
      ? 0
      : candidate.source.evidenceGrade === "B"
        ? 3
        : candidate.source.evidenceGrade === "C"
          ? 7
          : 12;
  const score = clampScore(50 + percentBelowEstimate * 2.5 - evidencePenalty);

  return {
    score,
    estimatedFairBaseRent: Math.round(fairRent),
    percentBelowEstimate: Number(percentBelowEstimate.toFixed(1)),
    comparableCount: comparables.length,
    explanation: `${candidate.baseRent <= fairRent ? "Below" : "Above"} the blended same-bedroom estimate of $${Math.round(fairRent).toLocaleString()} from ${comparables.length} displayed comparables; the evidence grade contributes a ${evidencePenalty}-point confidence adjustment.`,
    caveat:
      "The comparison uses only displayed listings, bedrooms and square footage. It does not fully control for condition, concessions, fees or exact micro-location.",
  };
}

export function scorePersonalFit(
  candidate: ApartmentCandidate,
  preferences: Preference[],
  anchors: SearchAnchor[],
) {
  const consideredPreferences = activePreferences(preferences);
  const consideredAnchors = activeAnchors(anchors);
  const matched: string[] = [];
  const tensions: string[] = [];
  const unknowns = [...candidate.unknowns];
  let score = 50;
  let possibleWeight = 0;

  for (const preference of consideredPreferences) {
    const confidence = Math.max(0.25, Math.min(1, preference.confidence));
    const textValue = String(preference.value).toLowerCase();
    let contribution = 0;
    let weight = 0;

    if (preference.kind === "budget" && typeof preference.value === "number") {
      weight = 24;
      const high = candidate.allInEstimate.high;
      if (high == null) {
        unknowns.push(`All-in cost needed to verify “${preference.label}”.`);
      } else if (high <= preference.value) {
        contribution = weight;
        matched.push(`${preference.label}: estimated high is $${high.toLocaleString()}.`);
      } else {
        contribution = -weight;
        tensions.push(`${preference.label}: estimated high is $${high.toLocaleString()}.`);
      }
    } else if (preference.kind === "bedrooms" && typeof preference.value === "number") {
      weight = 14;
      if (candidate.bedrooms != null && candidate.bedrooms >= preference.value) {
        contribution = weight;
        matched.push(`${candidate.bedrooms} bedroom${candidate.bedrooms === 1 ? "" : "s"}.`);
      } else {
        contribution = -weight;
        tensions.push(`Does not meet ${preference.label.toLowerCase()}.`);
      }
    } else if (preference.kind === "minimum_space" && typeof preference.value === "number") {
      weight = 14;
      if (candidate.squareFeet != null && candidate.squareFeet >= preference.value) {
        contribution = weight;
        matched.push(`${candidate.squareFeet.toLocaleString()} square feet meets the stated minimum.`);
      } else if (candidate.squareFeet == null) {
        unknowns.push(`Square footage needed to verify “${preference.label}”.`);
      } else {
        contribution = -weight;
        tensions.push(`${candidate.squareFeet.toLocaleString()} square feet is below the stated minimum.`);
      }
    } else if (preference.kind === "furniture") {
      weight = 10;
      if ((candidate.bedrooms ?? 0) >= 2 || (candidate.squareFeet ?? 0) >= 750) {
        contribution = weight * 0.75;
        matched.push(`${preference.label}: space looks plausible, but measurements are still required.`);
      } else {
        contribution = -weight * 0.35;
        tensions.push(`${preference.label}: the smaller plan may require using the living area.`);
      }
    } else if (preference.kind === "amenity" || preference.kind === "lifestyle") {
      weight = 8;
      const haystack = `${candidate.features.join(" ")} ${candidate.neighborhood}`.toLowerCase();
      const alternativeTerms = textValue
        .split(/\s+or\s+|,/)
        .map((term) => term.trim())
        .filter(Boolean);
      if (alternativeTerms.some((term) => haystack.includes(term))) {
        contribution = weight;
        matched.push(preference.label);
      } else {
        unknowns.push(`“${preference.label}” is not established by the current evidence.`);
      }
    } else if (preference.kind === "lease") {
      weight = 8;
      const haystack = `${candidate.features.join(" ")} ${candidate.availability}`.toLowerCase();
      if (haystack.includes(textValue) || (textValue.includes("six") && haystack.includes("six-month"))) {
        contribution = weight;
        matched.push(preference.label);
      } else {
        unknowns.push(`Lease preference “${preference.label}” needs verification.`);
      }
    }

    possibleWeight += weight * confidence;
    score += contribution * confidence;
  }

  for (const anchor of consideredAnchors) {
    const distance = candidate.distances.find((item) => item.anchorId === anchor.id);
    const weight = anchor.importance * 2;
    possibleWeight += weight;
    if (distance?.straightLineMiles == null) {
      unknowns.push(`Distance to ${anchor.label} needs coordinates.`);
    } else if (distance.straightLineMiles <= 1) {
      score += weight;
      matched.push(`${distance.straightLineMiles} mi straight-line to ${anchor.label}.`);
    } else if (distance.straightLineMiles <= 3) {
      score += weight * 0.35;
      matched.push(`${distance.straightLineMiles} mi straight-line to ${anchor.label}.`);
    } else if (distance.straightLineMiles > 7) {
      score -= weight * 0.5;
      tensions.push(`${distance.straightLineMiles} mi straight-line to ${anchor.label}.`);
    }
  }

  const uniqueUnknowns = [...new Set(unknowns)].slice(0, 6);
  return {
    score: clampScore(score),
    matched: matched.slice(0, 6),
    tensions: tensions.slice(0, 6),
    unknowns: uniqueUnknowns,
    explanation:
      possibleWeight === 0
        ? "Neutral until the renter or their agent supplies preferences."
        : `Calculated from ${consideredPreferences.length} active preference${consideredPreferences.length === 1 ? "" : "s"} and ${consideredAnchors.length} location anchor${consideredAnchors.length === 1 ? "" : "s"}; pending agent proposals affect this search but are not saved preferences.`,
  };
}

export function scoreCandidates(
  candidates: ApartmentCandidate[],
  preferences: Preference[],
  anchors: SearchAnchor[],
): ApartmentCandidate[] {
  const withDistances = candidates.map((candidate) => ({
    ...candidate,
    distances: activeAnchors(anchors).map((anchor) =>
      estimateDistance(candidate.latitude, candidate.longitude, anchor),
    ),
  }));
  return withDistances.map((candidate) => {
    const marketValue = scoreMarketValue(candidate, withDistances);
    const personalFit = scorePersonalFit(candidate, preferences, anchors);
    const recommended = clampScore((personalFit.score + marketValue.score) / 2);
    const scores: CandidateScores = { marketValue, personalFit, recommended };
    return { ...candidate, scores };
  });
}

function freshnessValue(candidate: ApartmentCandidate) {
  const timestamp = Date.parse(candidate.source.observedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortCandidates(
  candidates: ApartmentCandidate[],
  sortBy: SortOption,
  direction: "asc" | "desc",
  anchorId: string | null,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  const value = (candidate: ApartmentCandidate): number => {
    switch (sortBy) {
      case "market_value":
        return candidate.scores.marketValue.score;
      case "personal_fit":
        return candidate.scores.personalFit.score;
      case "all_in_cost":
        return candidate.allInEstimate.high ?? Number.POSITIVE_INFINITY;
      case "base_rent":
        return candidate.baseRent ?? Number.POSITIVE_INFINITY;
      case "distance":
        return (
          candidate.distances.find((distance) => distance.anchorId === anchorId)
            ?.straightLineMiles ?? Number.POSITIVE_INFINITY
        );
      case "square_feet":
        return candidate.squareFeet ?? 0;
      case "freshness":
        return freshnessValue(candidate);
      case "recommended":
      default:
        return candidate.scores.recommended;
    }
  };

  return [...candidates].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === right) return a.name.localeCompare(b.name);
    return (left - right) * multiplier;
  });
}
