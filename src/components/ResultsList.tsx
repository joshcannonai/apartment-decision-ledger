import {
  ArrowDownUp,
  Check,
  Clock3,
  ListFilter,
  MapPin,
  Ruler,
} from "lucide-react";
import type { ApartmentCandidate, SearchAnchor, SortOption } from "../domain/types";
import { formatFreshness, formatMoney, scoreTone } from "./format";

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
}: ResultsListProps) {
  return (
    <section className="results-region" aria-label="Ranked apartment results">
      <div className="region-heading results-heading">
        <div>
          <p className="eyebrow">Ranked shortlist</p>
          <h2>{candidates.length} best options</h2>
        </div>
        <button className="filter-button" type="button" aria-label="Filters are available in refinement panel">
          <ListFilter size={17} />
        </button>
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

            return (
              <li key={candidate.id}>
                <article
                  className={`result-row${selected ? " is-selected" : ""}`}
                  aria-current={selected ? "true" : undefined}
                >
                  <button className="result-main" type="button" onClick={() => onSelect(candidate.id)}>
                    <span className="result-rank">{String(index + 1).padStart(2, "0")}</span>
                    <span className="result-copy">
                      <span className="result-title-line">
                        <strong>{candidate.name}</strong>
                        <span className={`score-number ${scoreTone(candidate.scores.recommended)}`}>
                          {candidate.scores.recommended}
                        </span>
                      </span>
                      <span className="result-location">{candidate.neighborhood}</span>
                      <span className="result-cost">
                        {formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)} all in
                      </span>
                      <span className="result-meta">
                        <span><Ruler size={13} /> {candidate.squareFeet ?? "—"} sq ft</span>
                        {primaryDistance ? (
                          <span><MapPin size={13} /> {primaryDistance.straightLineMiles?.toFixed(1)} mi</span>
                        ) : null}
                        <span><Clock3 size={13} /> {formatFreshness(candidate.source.observedAt)}</span>
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
