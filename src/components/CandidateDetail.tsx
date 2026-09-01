import {
  AlertCircle,
  Building,
  CalendarClock,
  Check,
  ExternalLink,
  MapPin,
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ApartmentCandidate } from "../domain/types";
import { formatFreshness, formatMoney, scoreTone } from "./format";

type CandidateDetailProps = {
  candidate: ApartmentCandidate;
  comparisonIds: string[];
  isStaged: boolean;
  onToggleCompare: (candidateId: string) => void;
  onStage: (candidateId: string) => void;
};

function Score({ label, score, explanation }: { label: string; score: number; explanation: string }) {
  return (
    <div className="score-block">
      <div className="score-header">
        <span>{label}</span>
        <strong className={scoreTone(score)}>{score}</strong>
      </div>
      <div className="score-track" aria-label={`${label}: ${score} out of 100`}>
        <span className={scoreTone(score)} style={{ width: `${score}%` }} />
      </div>
      <p>{explanation}</p>
    </div>
  );
}
export function CandidateDetail({
  candidate,
  comparisonIds,
  isStaged,
  onToggleCompare,
  onStage,
}: CandidateDetailProps) {
  const compared = comparisonIds.includes(candidate.id);

  return (
    <article className="candidate-detail">
      <div className="detail-topline">
        <div>
          <p className="detail-neighborhood">{candidate.neighborhood}</p>
          <h1>{candidate.name}</h1>
          <p className="detail-address">{candidate.address}, {candidate.city}</p>
        </div>
        <div className="recommendation-score">
          <span>Recommended</span>
          <strong className={scoreTone(candidate.scores.recommended)}>{candidate.scores.recommended}</strong>
          <small>out of 100</small>
        </div>
      </div>

      <div className="detail-actions">
        <button
          className={`secondary-button${compared ? " is-active" : ""}`}
          type="button"
          onClick={() => onToggleCompare(candidate.id)}
          aria-pressed={compared}
        >
          {compared ? <Check size={16} /> : <Scale size={16} />}
          {compared ? "Added to compare" : "Add to compare"}
        </button>
        <button className="primary-button" type="button" onClick={() => onStage(candidate.id)} disabled={isStaged}>
          <Sparkles size={16} />
          {isStaged ? "Staged for review" : "Stage as leading option"}
        </button>
      </div>

      <section className="cost-ledger" aria-labelledby="cost-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="cost-heading">What this could actually cost</h2>
            <p>Advertised rent, planning range, and usable space in one view.</p>
          </div>
          <span className="evidence-badge">Evidence {candidate.source.evidenceGrade}</span>
        </div>
        <div className="cost-grid">
          <div>
            <span>Advertised base</span>
            <strong>{formatMoney(candidate.baseRent)}</strong>
            <small>per month</small>
          </div>
          <div>
            <span>Estimated all in</span>
            <strong>{formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)}</strong>
            <small>{candidate.allInEstimate.note}</small>
          </div>
          <div>
            <span>Space</span>
            <strong>{candidate.squareFeet ?? "Unknown"}</strong>
            <small>{candidate.bedrooms ?? "—"} bed · {candidate.bathrooms ?? "—"} bath</small>
          </div>
        </div>
      </section>

      <section className="score-section" aria-labelledby="score-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="score-heading">Value is not the same as fit</h2>
            <p>Market pricing and personal constraints stay separate.</p>
          </div>
        </div>
        <div className="score-grid">
          <Score
            label="Market value"
            score={candidate.scores.marketValue.score}
            explanation={candidate.scores.marketValue.explanation}
          />
          <Score
            label="Personal fit"
            score={candidate.scores.personalFit.score}
            explanation={candidate.scores.personalFit.explanation}
          />
        </div>
        <p className="score-caveat"><AlertCircle size={14} /> {candidate.scores.marketValue.caveat}</p>
      </section>

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
          <h2>Open questions</h2>
          <ul className="signal-list unknown-list">
            {candidate.unknowns.map((item) => <li key={item}><AlertCircle size={15} /> {item}</li>)}
          </ul>
        </section>
      </div>

      <footer className="source-footer">
        <div>
          <ShieldCheck size={17} />
          <span>
            <strong>{candidate.source.label}</strong>
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
