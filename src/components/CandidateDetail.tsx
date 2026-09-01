import { useState } from "react";
import { AlertCircle, Building, CalendarClock, Check, ExternalLink, ImageOff, MapPin, Ruler, Scale, ShieldCheck, Sparkles } from "lucide-react";
import type { ApartmentCandidate, CandidateMedia } from "../domain/types";
import { orderCandidateMedia } from "../media/order";
import type { MediaPhase } from "../media/priority";
import { mediaLoadingHint, shouldRequestMedia } from "../media/priority";
import { formatFreshness, formatMoney, scoreTone } from "./format";

type RunContext = {
  number: number;
  previousCandidate: ApartmentCandidate | null;
  previousRank: number | null;
  triggerLabels: string[];
};

type CandidateDetailProps = {
  candidate: ApartmentCandidate;
  comparisonIds: string[];
  isStaged: boolean;
  onToggleCompare: (candidateId: string) => void;
  onStage: (candidateId: string) => void;
  rank: number;
  runContext: RunContext;
  mediaPhase: MediaPhase;
  onMediaSettled: (candidateId: string, mediaIndex: number, rank: number) => void;
};

function mediaScopeLabel(scope: CandidateMedia["scope"]) {
  if (scope === "exact_unit") return "Exact-unit photo";
  if (scope === "building") return "Building photo";
  return "Community gallery photo";
}

function ScoreWheel({ label, score }: { label: string; score: number }) {
  const boundedScore = Math.max(0, Math.min(100, score));
  return (
    <div className={`score-wheel ${scoreTone(score)}`} aria-label={`${label}: ${score} out of 100`}>
      <div className="score-wheel-gauge">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className="score-wheel-track" cx="32" cy="32" r="25" pathLength="100" />
          <circle className="score-wheel-value" cx="32" cy="32" r="25" pathLength="100" strokeDasharray={`${boundedScore} ${100 - boundedScore}`} />
        </svg>
        <strong>{score}</strong>
      </div>
      <span>{label}</span>
    </div>
  );
}

function rankingNarrative(candidate: ApartmentCandidate, rank: number, run: RunContext) {
  const strongestSignal = candidate.scores.personalFit.matched[0] ?? candidate.scores.marketValue.explanation;
  if (run.number > 1 && run.previousRank != null) {
    const movement = run.previousRank - rank;
    const movementText = movement > 0
      ? `rose ${movement} place${movement === 1 ? "" : "s"}`
      : movement < 0
        ? `moved down ${Math.abs(movement)} place${Math.abs(movement) === 1 ? "" : "s"}`
        : "held its position";
    const context = run.triggerLabels[0] ?? "your latest answer";
    return `In Run ${run.number}, this option ${movementText} after “${context}”. ${strongestSignal}`;
  }
  return `Ranked #${rank + 1} because it currently offers one of the strongest balances of all-in cost, evidence quality, and personal fit. ${strongestSignal}`;
}

export function CandidateDetail({ candidate, comparisonIds, isStaged, onToggleCompare, onStage, rank, runContext, mediaPhase, onMediaSettled }: CandidateDetailProps) {
  const [mediaSelection, setMediaSelection] = useState({ candidateId: candidate.id, index: 0 });
  const compared = comparisonIds.includes(candidate.id);
  const media = orderCandidateMedia(candidate.media ?? []);
  const activeMediaIndex = mediaSelection.candidateId === candidate.id ? Math.min(mediaSelection.index, Math.max(0, media.length - 1)) : 0;
  const activeMedia = media[activeMediaIndex] ?? media[0];
  const activeRequest = activeMedia ? shouldRequestMedia({ phase: mediaPhase, rank, mediaIndex: activeMediaIndex, selected: true }) : false;
  const activeHint = mediaLoadingHint({ rank, mediaIndex: activeMediaIndex, selected: true });
  const tensions = candidate.scores.personalFit.tensions;

  return (
    <article className="candidate-detail">
      <header className="detail-topline">
        <div>
          <p className="detail-neighborhood">{candidate.neighborhood}<span>Recommended {candidate.scores.recommended}</span></p>
          <h1>{candidate.name}</h1>
          <p className="detail-address">{candidate.address}, {candidate.city}</p>
        </div>
        <div className="detail-actions">
          <button className={`secondary-button${compared ? " is-active" : ""}`} type="button" onClick={() => onToggleCompare(candidate.id)} aria-pressed={compared}>
            {compared ? <Check size={15} /> : <Scale size={15} />}{compared ? "Comparing" : "Compare"}
          </button>
          <button className="primary-button" type="button" onClick={() => onStage(candidate.id)} disabled={isStaged}>
            <Sparkles size={15} />{isStaged ? "Leader staged" : "Stage leader"}
          </button>
        </div>
      </header>

      <div className="decision-overview">
        <figure className="media-stage">
          <div className="media-stage-grid">
            <div className="media-hero">
              {activeMedia && activeRequest ? (
                <img key={activeMedia.url} data-media-role="lead-hero" data-media-index={activeMediaIndex} src={activeMedia.url} alt={activeMedia.alt} loading={activeHint.loading} fetchPriority={activeHint.fetchPriority} decoding="async" onLoad={() => onMediaSettled(candidate.id, activeMediaIndex, rank)} onError={() => onMediaSettled(candidate.id, activeMediaIndex, rank)} />
              ) : activeMedia ? (
                <span className="media-skeleton" aria-label="Listing photo queued" />
              ) : (
                <span className="media-empty"><ImageOff size={23} /><strong>No verified media yet</strong><small>Listing facts remain available.</small></span>
              )}
            </div>
            <div className="media-filmstrip" aria-label="Listing photos and source">
              {media.map((item, index) => {
                const requestThumbnail = mediaPhase !== "lead" && shouldRequestMedia({ phase: mediaPhase, rank, mediaIndex: index, selected: true });
                const hint = mediaLoadingHint({ rank, mediaIndex: index, selected: true });
                return (
                  <button key={item.url} type="button" className={index === activeMediaIndex ? "is-active" : ""} onClick={() => setMediaSelection({ candidateId: candidate.id, index })} aria-label={`Show ${item.kind === "floor_plan" ? "floor plan" : `photo ${index + 1}`}: ${item.alt}`} aria-pressed={index === activeMediaIndex}>
                    {requestThumbnail ? (
                      <img data-media-role="detail-thumbnail" data-media-index={index} src={item.thumbnailUrl} alt="" loading={hint.loading} fetchPriority={hint.fetchPriority} decoding="async" onLoad={() => onMediaSettled(candidate.id, index, rank)} onError={() => onMediaSettled(candidate.id, index, rank)} />
                    ) : <span className="media-skeleton" aria-hidden="true" />}
                    {item.kind === "floor_plan" ? <span>Floor plan</span> : null}
                  </button>
                );
              })}
              <a className="listing-source-card" href={candidate.source.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /><span><strong>Open original listing</strong><small>Source details</small></span>
              </a>
            </div>
          </div>
          {activeMedia ? (
            <figcaption><span>{mediaScopeLabel(activeMedia.scope)} · {activeMedia.sourceLabel}</span><a href={activeMedia.sourceUrl} target="_blank" rel="noreferrer">Photo source <ExternalLink size={13} /></a></figcaption>
          ) : null}
        </figure>

        <aside className="decision-rail" aria-label="Decision summary">
          <div className="all-in-summary"><span>Estimated all in</span><strong>{formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)}</strong><small>(base {formatMoney(candidate.baseRent)})</small></div>
          <div className="space-summary"><span>Space</span><strong>{candidate.squareFeet ?? "Unknown"} <small>sq ft</small></strong><small>{candidate.bedrooms ?? "—"} bed · {candidate.bathrooms ?? "—"} bath</small></div>
          <div className="score-pair"><ScoreWheel label="Market Value" score={candidate.scores.marketValue.score} /><ScoreWheel label="Personal Fit" score={candidate.scores.personalFit.score} /></div>
          <p className="ranking-narrative">{rankingNarrative(candidate, rank, runContext)}</p>
        </aside>
      </div>

      <p className="score-caveat"><AlertCircle size={14} /> {candidate.scores.marketValue.caveat}</p>
      <section className="detail-facts" aria-label="Listing facts">
        <div><Building size={17} /><span>Availability</span><strong>{candidate.availability}</strong></div>
        <div><Ruler size={17} /><span>Layout</span><strong>{candidate.squareFeet ?? "Unknown"} sq ft · {candidate.bedrooms ?? "—"} bed</strong></div>
        {candidate.distances.slice(0, 2).map((distance) => <div key={distance.anchorId}><MapPin size={17} /><span>{distance.anchorLabel}</span><strong>{distance.straightLineMiles == null ? "Needs location" : `${distance.straightLineMiles.toFixed(1)} mi estimated`}</strong></div>)}
      </section>

      <div className="decision-evidence">
        <section>
          <h2>What fits</h2>
          <ul className="signal-list positive-list">{(candidate.scores.personalFit.matched.length > 0 ? candidate.scores.personalFit.matched : candidate.features.slice(0, 4)).map((item) => <li key={item}><Check size={15} /> {item}</li>)}</ul>
        </section>
        <div className="decision-gaps">
          <section><h2>Things it’s missing</h2>{tensions.length > 0 ? <ul className="signal-list tension-list">{tensions.map((item) => <li key={item}><AlertCircle size={15} /> {item}</li>)}</ul> : <p>No confirmed mismatch from the context used in this run.</p>}</section>
          <section><h2>Verify before deciding</h2><ul className="signal-list unknown-list">{candidate.unknowns.map((item) => <li key={item}><AlertCircle size={15} /> {item}</li>)}</ul></section>
        </div>
      </div>

      <footer className="source-footer"><div><ShieldCheck size={17} /><span><strong>{candidate.source.label} · Evidence {candidate.source.evidenceGrade}</strong><small><CalendarClock size={13} /> {formatFreshness(candidate.source.observedAt)}</small></span></div></footer>
    </article>
  );
}
