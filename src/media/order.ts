import type { CandidateMedia } from "../domain/types";

export function orderCandidateMedia(media: CandidateMedia[]) {
  const floorPlans = media.filter((item) => item.kind === "floor_plan");
  if (floorPlans.length === 0) return media;

  const photos = media.filter((item) => item.kind !== "floor_plan");
  if (photos.length < 3) return [...photos, ...floorPlans];

  return [
    ...photos.slice(0, 3),
    floorPlans[0],
    ...photos.slice(3),
    ...floorPlans.slice(1),
  ];
}
