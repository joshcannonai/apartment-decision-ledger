export function formatMoney(value: number | null) {
  if (value == null) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatFreshness(observedAt: string) {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return "Freshness unknown";

  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - observed.getTime()) / 86_400_000),
  );

  if (elapsedDays === 0) return "Checked today";
  if (elapsedDays === 1) return "Checked yesterday";
  return `Checked ${elapsedDays} days ago`;
}

export function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}% confidence`;
}

export function scoreTone(score: number) {
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "mixed";
  return "weak";
}
