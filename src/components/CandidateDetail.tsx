import { useState } from "react";
import {
  AlertCircle,
  Building,
  CalendarClock,
  Check,
  ExternalLink,
  ImageOff,
  MapPin,
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ApartmentCandidate, CandidateMedia } from "../domain/types";
import type { MediaPhase } from "../media/priority";
import { mediaLoadingHint, shouldRequestMedia } from "../media/priority";
import { formatFreshness, formatMoney, scoreTone } from "./format";

type CandidateDetailProps = {
  candidate: ApartmentCandidate;
  comparisonIds: string[];
  isStaged: boolean;
  onToggleCompare: (candidateId: string) => void;
  onStage: (candidateId: string) => void;
  rank: number;
  mediaPhase: MediaPhase;
  onMediaSettled: (candidateId: string, mediaIndex: number, rank: number) => void;
};

function mediaScopeLabel(scope: CandidateMedia["scope"]) {
  if (scope === "exact_unit") return "Exact-unit photo";
  if (scope === "building") return "Building photo";
  return "Community gallery photo";
}

function ScoreWheel({ label, score }: { label: string; score: number }) {
  const circumference = 2 * Math.PI * 25;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="score-wheel" aria-label={`${label}: ${score} out of 100`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="score-wheel-track" cx="32" cy="32" r="25" />
        <circle
          className={`score-wheel-value ${scoreTone(score)}`}
          cx="32"
          cy="32"
          r="25"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <strong>{score}</strong>
      <span>{label}</span>
    </div>
  );
}

export function CandidateDetail({
  candidate,
  comparisonIds,
  isStaged,
  onToggleCompare,
  onStage,
  rank,
  mediaPhase,
  onMediaSettled,
}: CandidateDetailProps) {
  const [mediaSelection, setMediaSelection] = useState({ candidateId: candidate.id, index: 0 });
  const compared = comparisonIds.includes(candidate.id);
  const media = candidate.media ?? [];
  const activeMediaIndex = mediaSelection.candidateId === candidate.id
    ? Math.min(mediaSelection.index, Math.max(0, media.length - 1))
    : 0;
  const activeMedia = media[activeMediaIndex] ?? media[0];

  const activeRequest = activeMedia ? shouldRequestMedia({
    phase: mediaPhase,
    rank,
    mediaIndex: activeMediaIndex,
    selected: true,
  }) : false;
  const activeHint = mediaLoadingHint({ rank, mediaIndex: activeMediaIndex, selected: true });

  return (
    <article className="candidate-detail">
      <header className="detail-topline">
        <div>
          <p className="detail-neighborhood">
            {candidate.neighborhood}
            <span>Recommended {candidate.scores.recommended}</span>
          </p>
          <h1>{candidate.name}</h1>
          <p className="detail-address">{candidate.address}, {candidate.city}</p>
        </div>
        <div className="detail-actions">
          <button
            className={`secondary-button${compared ? " is-active" : ""}`}
            type="button"
            onClick={() => onToggleCompare(candidate.id)}
            aria-pressed={compared}
          >
            {compared ? <Check size={15} /> : <Scale size={15} />}
            {compared ? "Comparing" : "Compare"}
          </button>
          <button className="primary-button" type="button" onClick={() => onStage(candidate.id)} disabled={isStaged}>
            <Sparkles size={15} />
            {isStaged ? "Leader staged" : "Stage leader"}
          </button>
        </div>
      </header>

      <figure className="media-stage">
        <div className="media-hero">
          {activeMedia && activeRequest ? (
            <img
              key={activeMedia.url}
              data-media-role="lead-hero"
              data-media-index={activeMediaIndex}
              src={activeMedia.url}
              alt={activeMedia.alt}
              loading={activeHint.loading}
              fetchPriority={activeHint.fetchPriority}
              decoding="async"
              onLoad={() => onMediaSettled(candidate.id, activeMediaIndex, rank)}
              onError={() => onMediaSettled(candidate.id, activeMediaIndex, rank)}
            />
          ) : activeMedia ? (
            <span className="media-skeleton" aria-label="Listing photo queued" />
          ) : (
            <span className="media-empty"><ImageOff size={23} /><strong>No verified media yet</strong><small>Listing facts remain available below.</small></span>
          )}
        </div>
        {media.length > 1 ? (
          <div className="media-thumbnails" aria-label="Listing photos">
            {media.slice(0, 4).map((item, index) => {
              const requestThumbnail = mediaPhase !== "lead" && shouldRequestMedia({
                phase: mediaPhase,
                rank,
                mediaIndex: index,
                selected: true,
              });
              const hint = mediaLoadingHint({ rank, mediaIndex: index, selected: true });
              return (
                <button
                  key={item.url}
                  type="button"
                  className={index === activeMediaIndex ? "is-active" : ""}
                  onClick={() => setMediaSelection({ candidateId: candidate.id, index })}
                  aria-label={`Show photo ${index + 1}: ${item.alt}`}
                  aria-pressed={index === activeMediaIndex}
                >
                  {requestThumbnail ? (
                    <img
                      data-media-role="detail-thumbnail"
                      data-media-index={index}
                      src={item.thumbnailUrl}
                      alt=""
                      loading={hint.loading}
                      fetchPriority={hint.fetchPriority}
                      decoding="async"
                      onLoad={() => onMediaSettled(candidate.id, index, rank)}
                      onError={() => onMediaSettled(candidate.id, index, rank)}
                    />
                  ) : <span className="media-skeleton" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ) : null}
        {activeMedia ? (
          <figcaption>
            <span>{mediaScopeLabel(activeMedia.scope)} · {activeMedia.sourceLabel}</span>
            <a href={activeMedia.sourceUrl} target="_blank" rel="noreferrer">Media source <ExternalLink size={13} /></a>
          </figcaption>
        ) : null}
      </figure>

      <section className="decision-summary" aria-label="Decision summary">
        <div className="all-in-summary">
          <span>Estimated all in</span>
          <strong>{formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)}</strong>
          <small>(base {formatMoney(candidate.baseRent)})</small>
        </div>
        <div className="space-summary">
          <span>Space</span>
          <strong>{candidate.squareFeet ?? "Unknown"} <small>sq ft</small></strong>
          <small>{candidate.bedrooms ?? "—"} bed · {candidate.bathrooms ?? "—"} bath</small>
        </div>
        <ScoreWheel label="Market Value" score={candidate.scores.marketValue.score} />
        <ScoreWheel label="Personal Fit" score={candidate.scores.personalFit.score} />
      </section>

      <p className="score-caveat"><AlertCircle size={14} /> {candidate.scores.marketValue.caveat}</p>

      <section className="detail-facts" aria-label="Listing facts">
        <div>
          <Building size={17} />
          <span>Availability</span>
          <strong>{candidate.availability}</strong>
        </div>
        <div>
          <Ruler size={17} />
          <span>Layout</span>
          <strong>{candidate.squareFeet ?? "Unknown"} sq ft · {candidate.bedrooms ?? "—"} bed</strong>
        </div>
        {candidate.distances.slice(0, 2).map((distance) => (
          <div key={distance.anchorId}>
            <MapPin size={17} />
            <span>{distance.anchorLabel}</span>
            <strong>{distance.straightLineMiles == null ? "Needs location" : `${distance.straightLineMiles.toFixed(1)} mi estimated`}</strong>
          </div>
        ))}
      </section>

      <div className="detail-columns">
        <section>
          <h2>Why it rose</h2>
          <ul className="signal-list positive-list">
            {candidate.scores.personalFit.matched.length > 0
              ? candidate.scores.personalFit.matched.map((item) => <li key={item}><Check size={15} /> {item}</li>)
              : candidate.features.slice(0, 4).map((item) => <li key={item}><Check size={15} /> {item}</li>)}
          </ul>
        </section>
        <section>
          <h2>Verify before deciding</h2>
          <ul className="signal-list unknown-list">
            {candidate.unknowns.map((item) => <li key={item}><AlertCircle size={15} /> {item}</li>)}
          </ul>
        </section>
      </div>

      <footer className="source-footer">
        <div>
          <ShieldCheck size={17} />
          <span>
            <strong>{candidate.source.label} · Evidence {candidate.source.evidenceGrade}</strong>
            <small><CalendarClock size={13} /> {formatFreshness(candidate.source.observedAt)}</small>
          </span>
        </div>
        <a href={candidate.source.url} target="_blank" rel="noreferrer">
          Open original listing <ExternalLink size={15} />
        </a>
      </footer>
    </article>
  );
}
