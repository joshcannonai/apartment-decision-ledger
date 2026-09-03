import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  Ruler,
} from "lucide-react";
import type { ApartmentCandidate, SearchAnchor, SearchRun, SortOption } from "../domain/types";
import { formatFreshness, formatMoney, scoreTone } from "./format";
import type { MediaPhase } from "../media/priority";
import { orderCandidateMedia } from "../media/order";
import { mediaLoadingHint, shouldRequestMedia } from "../media/priority";

type ResultsListProps = {
  candidates: ApartmentCandidate[];
  selectedId: string | null;
  comparisonIds: string[];
  sortBy: SortOption;
  anchors: SearchAnchor[];
  sourceNote: string;
  onSelect: (candidateId: string) => void;
  onToggleCompare: (candidateId: string) => void;
  onSort: (sort: SortOption) => void;
  mediaPhase: MediaPhase;
  visibleHeroCount: number;
  onMediaSettled: (candidateId: string, mediaIndex: number, rank: number) => void;
  searchRuns: SearchRun[];
  activeRunNumber: number | null;
  onSelectRun: (runNumber: number) => void;
};

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "market_value", label: "Market value" },
  { value: "personal_fit", label: "Personal fit" },
  { value: "all_in_cost", label: "All-in cost" },
  { value: "base_rent", label: "Base rent" },
  { value: "distance", label: "Distance" },
  { value: "square_feet", label: "Square feet" },
  { value: "freshness", label: "Freshness" },
];

export function ResultsList({
  candidates,
  selectedId,
  comparisonIds,
  sortBy,
  anchors,
  sourceNote,
  onSelect,
  onToggleCompare,
  onSort,
  mediaPhase,
  visibleHeroCount,
  onMediaSettled,
  searchRuns,
  activeRunNumber,
  onSelectRun,
}: ResultsListProps) {
  const readyRuns = searchRuns.filter((run) => run.status === "ready");
  const activeRunIndex = readyRuns.findIndex((run) => run.number === activeRunNumber);
  const previousRun = activeRunIndex > 0 ? readyRuns[activeRunIndex - 1] : null;
  return (
    <section className="results-region" aria-label="Ranked apartment results">
      <div className="region-heading results-heading">
        <div>
          <h2>{candidates.length} best options</h2>
          <p>Ranked for this search</p>
        </div>
        <div className="run-tabs" aria-label="Ranking runs">
          {searchRuns.map((run) => (
            <button
              key={run.id}
              type="button"
              className={run.number === activeRunNumber ? "is-active" : ""}
              disabled={run.status !== "ready"}
              aria-pressed={run.number === activeRunNumber}
              onClick={() => onSelectRun(run.number)}
            >
              {run.status === "searching" ? <LoaderCircle className="spin" size={12} /> : null}
              Run {run.number}
            </button>
          ))}
        </div>
      </div>

      <p className="results-source-note"><Clock3 size={13} /> {sourceNote}</p>

      <label className="sort-control">
        <ArrowDownUp size={15} aria-hidden="true" />
        <span>Sort</span>
        <select value={sortBy} onChange={(event) => onSort(event.target.value as SortOption)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {sortBy === "distance" && anchors.length === 0 ? (
        <p className="inline-notice">Add a location anchor to sort by distance.</p>
      ) : null}

      <div className="results-scroll scroll-well">
        <ol className="result-list">
          {candidates.map((candidate, index) => {
            const selected = candidate.id === selectedId;
            const compared = comparisonIds.includes(candidate.id);
            const primaryDistance = candidate.distances.find((distance) => distance.straightLineMiles != null);
            const heroMedia = orderCandidateMedia(candidate.media ?? [])[0];
            // During the lead phase the large decision image owns the only
            // high-priority request. The matching row thumbnail joins the
            // first-screen batch after that image settles.
            const withinProgressiveWindow = index < visibleHeroCount || selected;
            const requestHero = heroMedia && withinProgressiveWindow && !(mediaPhase === "lead" && index === 0) ? shouldRequestMedia({
              phase: mediaPhase,
              rank: index,
              mediaIndex: 0,
              selected,
            }) : false;
            const loadingHint = mediaLoadingHint({ rank: index, mediaIndex: 0, selected });
            const previousRank = previousRun?.candidates.findIndex((item) => item.id === candidate.id) ?? -1;
            const rankDelta = previousRank >= 0 ? previousRank - index : null;

            return (
              <li key={candidate.id}>
                <article
                  className={`result-row${selected ? " is-selected" : ""}`}
                  aria-current={selected ? "true" : undefined}
                >
                  <button className="result-main" type="button" onClick={() => onSelect(candidate.id)}>
                    <span className={`result-media${requestHero ? " is-requested" : ""}`}>
                      {requestHero && heroMedia ? (
                        <img
                          data-media-rank={index + 1}
                          data-media-role="result-hero"
                          src={heroMedia.thumbnailUrl}
                          alt=""
                          loading={loadingHint.loading}
                          fetchPriority={loadingHint.fetchPriority}
                          decoding="async"
                          onLoad={() => onMediaSettled(candidate.id, 0, index)}
                          onError={() => onMediaSettled(candidate.id, 0, index)}
                        />
                      ) : heroMedia ? (
                        <span className="media-skeleton" aria-hidden="true" />
                      ) : (
                        <span className="media-skeleton media-skeleton--preview" aria-label="Room preview loading" />
                      )}
                      {requestHero && heroMedia?.scope === "illustrative" ? <span className="result-media-label">Illustrative</span> : null}
                      <span className="result-rank">{String(index + 1).padStart(2, "0")}</span>
                    </span>
                    <span className="result-copy">
                      <span className="result-title-line">
                        <strong>{candidate.name}</strong>
                        <span className={`score-number ${scoreTone(candidate.scores.recommended)}`}>
                          {candidate.scores.recommended}
                        </span>
                      </span>
                      <span className="result-location">{candidate.neighborhood}</span>
                      {rankDelta != null && rankDelta !== 0 ? (
                        <span className={`result-change ${rankDelta > 0 ? "rose" : "fell"}`}>
                          {rankDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {rankDelta > 0 ? "Up" : "Down"} {Math.abs(rankDelta)} in this run
                        </span>
                      ) : null}
                      <span className="result-cost">
                        {formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)} all in
                      </span>
                      <span className="result-meta">
                        <span><Ruler size={13} /> {candidate.squareFeet ?? "—"} sq ft</span>
                        {primaryDistance ? (
                          <span><MapPin size={13} /> {primaryDistance.straightLineMiles?.toFixed(1)} mi</span>
                        ) : null}
                        {index < 2 ? <span><Clock3 size={13} /> {formatFreshness(candidate.source.observedAt)}</span> : null}
                      </span>
                    </span>
                  </button>
                  <button
                    className={`compare-check${compared ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={compared}
                    aria-label={`${compared ? "Remove" : "Add"} ${candidate.name} ${compared ? "from" : "to"} comparison`}
                    onClick={() => onToggleCompare(candidate.id)}
                  >
                    {compared ? <Check size={14} /> : <span />}
                  </button>
                </article>
              </li>
            );
          })}
        </ol>
        <div className="scroll-fade scroll-fade-top" aria-hidden="true" />
        <div className="scroll-fade scroll-fade-bottom" aria-hidden="true" />
      </div>
    </section>
  );
}
