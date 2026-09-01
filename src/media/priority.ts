export type MediaPhase = "lead" | "shortlist" | "gallery" | "background";

const PHASE_ORDER: Record<MediaPhase, number> = {
  lead: 0,
  shortlist: 1,
  gallery: 2,
  background: 3,
};

export function shouldRequestMedia({
  phase,
  rank,
  mediaIndex,
  selected,
}: {
  phase: MediaPhase;
  rank: number;
  mediaIndex: number;
  selected: boolean;
}) {
  if (selected && mediaIndex === 0) return true;
  if (rank === 0 && mediaIndex === 0) return true;
  if (PHASE_ORDER[phase] >= PHASE_ORDER.shortlist && rank < 5 && mediaIndex === 0) return true;
  if (PHASE_ORDER[phase] >= PHASE_ORDER.gallery && selected && mediaIndex < 4) return true;
  return PHASE_ORDER[phase] >= PHASE_ORDER.background && mediaIndex === 0;
}

export function mediaLoadingHint({ rank, mediaIndex, selected }: { rank: number; mediaIndex: number; selected: boolean }) {
  if ((selected || rank === 0) && mediaIndex === 0) {
    return { loading: "eager" as const, fetchPriority: "high" as const };
  }
  return { loading: "lazy" as const, fetchPriority: "auto" as const };
}
