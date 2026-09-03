import { useState } from "react";
import {
  AlertCircle,
  Building,
  CalendarClock,
  Check,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { KNOWN_SLC_ANCHORS } from "../domain/geo";
import type { ApartmentCandidate, CandidateMedia, SearchAnchor } from "../domain/types";
import { buildGoogleMapUrls } from "../maps/googleMaps";
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
  onAddLocation: (label: string) => SearchAnchor;
  onSortByLocation: (anchorId: string) => void;
  onFocusLocation: (anchorId: string) => void;
  focusedAnchorId: string | null;
  rank: number;
  runContext: RunContext;
  mediaPhase: MediaPhase;
  onMediaSettled: (candidateId: string, mediaIndex: number, rank: number) => void;
};

function mediaScopeLabel(scope: CandidateMedia["scope"]) {
  if (scope === "illustrative") return "Illustrative demo media";
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

function fitNarrative(candidate: ApartmentCandidate, rank: number, run: RunContext) {
  const strongestSignal = candidate.scores.personalFit.matched.find(
    (signal) => !/estimated all-in|cost|rent/i.test(signal),
  ) ?? candidate.scores.personalFit.matched[0] ?? candidate.scores.marketValue.explanation;
  const cost = `${formatMoney(candidate.allInEstimate.low)}–${formatMoney(candidate.allInEstimate.high)} estimated all in`;
  const space = candidate.squareFeet != null
    ? `${candidate.squareFeet.toLocaleString()} square feet with ${candidate.bedrooms ?? "an unconfirmed number of"} bedroom${candidate.bedrooms === 1 ? "" : "s"}`
    : `${candidate.bedrooms ?? "an unconfirmed number of"} bedroom${candidate.bedrooms === 1 ? "" : "s"}, with square footage still unverified`;
  const verification = candidate.unknowns[0]
    ? `${candidate.unknowns[0].replace(/^./, (letter) => letter.toLowerCase())} before treating this ranking as final.`
    : candidate.scores.marketValue.caveat;

  if (run.number > 1 && run.previousRank != null) {
    const movement = run.previousRank - rank;
    const movementText = movement > 0
      ? `rose ${movement} place${movement === 1 ? "" : "s"}`
      : movement < 0
        ? `moved down ${Math.abs(movement)} place${Math.abs(movement) === 1 ? "" : "s"}`
        : "held its position";
    const context = run.triggerLabels[0]
      ? ` This rerank used your update: “${run.triggerLabels[0]}”.`
      : "";
    return {
      headline: `Run ${run.number}: ${movementText}, now ranked #${rank + 1}.`,
      explanation: `${strongestSignal} The listing combines ${cost} with ${space}.${context}`,
      verification,
    };
  }
  return {
    headline: `Ranked #${rank + 1} for its current balance of personal fit and total cost.`,
    explanation: `${strongestSignal} The listing combines ${cost} with ${space}.`,
    verification,
  };
}

export function CandidateDetail({ candidate, comparisonIds, isStaged, onToggleCompare, onStage, onAddLocation, onSortByLocation, onFocusLocation, focusedAnchorId, rank, runContext, mediaPhase, onMediaSettled }: CandidateDetailProps) {
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const compared = comparisonIds.includes(candidate.id);
  const activeMedia = orderCandidateMedia(candidate.media ?? [])[0];
  const activeRequest = activeMedia ? shouldRequestMedia({ phase: mediaPhase, rank, mediaIndex: 0, selected: true }) : false;
  const activeHint = mediaLoadingHint({ rank, mediaIndex: 0, selected: true });
  const tensions = candidate.scores.personalFit.tensions;
  const narrative = fitNarrative(candidate, rank, runContext);
  const activeAnchorId = focusedAnchorId && candidate.distances.some((distance) => distance.anchorId === focusedAnchorId)
    ? focusedAnchorId
    : candidate.distances[0]?.anchorId ?? null;
  const activeDistance = candidate.distances.find((distance) => distance.anchorId === activeAnchorId)
    ?? candidate.distances[0]
    ?? null;
  const mapOrigin = candidate.latitude != null && candidate.longitude != null
    ? `${candidate.latitude},${candidate.longitude}`
    : `${candidate.address}, ${candidate.city}, ${candidate.state}`;
  const listingMapUrls = buildGoogleMapUrls({
    origin: mapOrigin,
    embedApiKey: import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY,
  });
  const routeMapUrls = buildGoogleMapUrls({
    origin: mapOrigin,
    destination: activeDistance?.anchorLabel,
    embedApiKey: import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY,
  });

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
        <div className="media-map-pair">
          <figure className="media-stage">
            <div className="media-hero">
              {activeMedia && activeRequest ? (
                <img key={activeMedia.url} data-media-role="lead-hero" data-media-index="0" src={activeMedia.url} alt={activeMedia.alt} loading={activeHint.loading} fetchPriority={activeHint.fetchPriority} decoding="async" onLoad={() => onMediaSettled(candidate.id, 0, rank)} onError={() => onMediaSettled(candidate.id, 0, rank)} />
              ) : activeMedia ? (
                <span className="media-skeleton" aria-label="Listing photo queued" />
              ) : (
                <span className="media-loading-state" aria-label="Room preview enrichment queued">
                  <span className="media-skeleton" aria-hidden="true" />
                  <span className="media-loading-copy"><LoaderCircle className="spin" size={18} /><strong>Finding the clearest room view</strong><small>Kitchen and living areas are checked first.</small></span>
                </span>
              )}
            </div>
            <figcaption>
              <span>{activeMedia ? `${mediaScopeLabel(activeMedia.scope)} · ${activeMedia.sourceLabel}` : "Best room view queued"}</span>
              <a href={candidate.source.url}>Original listing <ExternalLink size={13} /></a>
            </figcaption>
          </figure>

          <section className="compact-map-card" aria-label={`Map preview for ${candidate.name}`}>
            <header><span><MapPin size={14} /> Location</span><small>Click to expand</small></header>
            <div className="compact-map-frame">
              <iframe
                key={candidate.id}
                title={`Google map showing ${candidate.name}`}
                src={listingMapUrls.embedUrl}
                loading="lazy"
                tabIndex={-1}
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <span className="compact-map-pin" aria-hidden="true"><MapPin size={24} fill="currentColor" /></span>
              <a href={listingMapUrls.openUrl} aria-label={`Expand map for ${candidate.name} in Google Maps`}><ExternalLink size={15} /> Expand map</a>
            </div>
          </section>
        </div>

        <section className="detail-facts listing-facts-rail" aria-label="Listing facts">
          <div><Building size={17} /><span>Availability</span><strong>{candidate.availability}</strong></div>
          <div><Ruler size={17} /><span>Layout</span><strong>{candidate.squareFeet ?? "Unknown"} sq ft · {candidate.bedrooms ?? "—"} bed</strong></div>
          {candidate.distances.slice(0, 2).map((distance) => <div key={distance.anchorId}><MapPin size={17} /><span>{distance.anchorLabel}</span><strong>{distance.straightLineMiles == null ? "Needs location" : `${distance.straightLineMiles.toFixed(1)} mi estimated`}</strong></div>)}
        </section>
      </div>

      <aside className="decision-rail" aria-label="Decision summary">
        <div className="all-in-summary"><span>Estimated all in</span><strong>{formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)}</strong><small>(base {formatMoney(candidate.baseRent)})</small></div>
        <div className="space-summary"><span>Space</span><strong>{candidate.squareFeet ?? "Unknown"} <small>sq ft</small></strong><small>{candidate.bedrooms ?? "—"} bed · {candidate.bathrooms ?? "—"} bath</small></div>
        <div className="score-pair"><ScoreWheel label="Market Value" score={candidate.scores.marketValue.score} /><ScoreWheel label="Personal Fit" score={candidate.scores.personalFit.score} /></div>
        <section className="ranking-narrative" aria-labelledby={`fit-narrative-${candidate.id}`}>
          <div className="ranking-narrative-label"><Sparkles size={16} /><span>Why the AI ranked it here</span></div>
          <div className="ranking-narrative-copy">
            <h2 id={`fit-narrative-${candidate.id}`}>{narrative.headline}</h2>
            <p>{narrative.explanation}</p>
            <p className="ranking-narrative-watch"><AlertCircle size={14} /><span><strong>Keep in mind:</strong> {narrative.verification}</span></p>
          </div>
        </section>
      </aside>

      <p className="score-caveat"><AlertCircle size={14} /> {candidate.scores.marketValue.caveat}</p>

      <section className="location-preview" aria-labelledby={`location-preview-${candidate.id}`}>
        <header>
          <div>
            <h2 id={`location-preview-${candidate.id}`}>Places that shape your week</h2>
            <p>Add or select a place to compare it with this listing.</p>
          </div>
          <a href={routeMapUrls.openUrl}>Open route in Google Maps <ExternalLink size={13} /></a>
        </header>

        <div className="location-anchor-row" aria-label="Locations used for distance context">
          {candidate.distances.map((distance) => (
            <button
              key={distance.anchorId}
              type="button"
              className={distance.anchorId === activeDistance?.anchorId ? "is-active" : ""}
              aria-pressed={distance.anchorId === activeDistance?.anchorId}
              onClick={() => onFocusLocation(distance.anchorId)}
            >
              <MapPin size={12} />
              <span>{distance.anchorLabel}</span>
              <strong>{distance.straightLineMiles == null ? "Route preview" : `${distance.straightLineMiles.toFixed(1)} mi`}</strong>
            </button>
          ))}
          <button className="add-location-button" type="button" onClick={() => setLocationEditorOpen(true)}>
            <Plus size={13} /> Add location
          </button>
        </div>

        {locationEditorOpen ? (
          <form
            className="add-location-form"
            onSubmit={(event) => {
              event.preventDefault();
              const label = locationDraft.trim();
              if (!label) return;
              const anchor = onAddLocation(label);
              onFocusLocation(anchor.id);
              setLocationDraft("");
              setLocationEditorOpen(false);
            }}
          >
            <MapPin size={15} aria-hidden="true" />
            <label className="sr-only" htmlFor={`location-${candidate.id}`}>Place name or address</label>
            <input
              id={`location-${candidate.id}`}
              list={`known-locations-${candidate.id}`}
              value={locationDraft}
              onChange={(event) => setLocationDraft(event.target.value)}
              placeholder="Place name or address"
              autoFocus
            />
            <datalist id={`known-locations-${candidate.id}`}>
              {KNOWN_SLC_ANCHORS.map((anchor) => <option value={anchor.label} key={anchor.label} />)}
            </datalist>
            <button className="primary-button" type="submit">Add to search</button>
            <button className="icon-button" type="button" aria-label="Cancel adding location" onClick={() => setLocationEditorOpen(false)}><X size={15} /></button>
          </form>
        ) : null}

        <footer>
          <span>
            <Navigation size={14} />
            {activeDistance
              ? activeDistance.straightLineMiles == null
                ? `${activeDistance.anchorLabel} is saved, but shortlist distance still needs verified coordinates.`
                : `${activeDistance.straightLineMiles.toFixed(1)} miles straight-line to ${activeDistance.anchorLabel}; open Google Maps for the live route.`
              : "Add a place to compare its route with this listing."}
          </span>
          {activeDistance ? (
            <button
              type="button"
              disabled={activeDistance.straightLineMiles == null}
              onClick={() => onSortByLocation(activeDistance.anchorId)}
            >
              Sort results by this place
            </button>
          ) : null}
        </footer>
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
