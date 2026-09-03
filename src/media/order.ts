import type { CandidateMedia } from "../domain/types";

function overviewScore(item: CandidateMedia) {
  const description = item.alt.toLowerCase();
  if (/kitchen.{0,40}living|living.{0,40}kitchen|great room|open[- ]plan/.test(description)) return 4;
  if (/living room|main room|interior overview/.test(description)) return 3;
  if (/kitchen|dining/.test(description)) return 2;
  if (/bedroom|bathroom|exterior|hallway|closet|amenity/.test(description)) return 0;
  return 1;
}

export function orderCandidateMedia(media: CandidateMedia[]) {
  const floorPlans = media.filter((item) => item.kind === "floor_plan");
  const photos = media
    .filter((item) => item.kind !== "floor_plan")
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => overviewScore(right.item) - overviewScore(left.item) || left.originalIndex - right.originalIndex)
    .map(({ item }) => item);

  if (floorPlans.length === 0) return photos;
  if (photos.length < 3) return [...photos, ...floorPlans];

  return [
    ...photos.slice(0, 3),
    floorPlans[0],
    ...photos.slice(3),
    ...floorPlans.slice(1),
  ];
}
