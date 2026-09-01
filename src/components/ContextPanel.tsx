import { useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ApartmentCandidate,
  Preference,
  RefinementQuestion,
  SearchAnchor,
  StagedDecision,
  WorkspaceEvent,
} from "../domain/types";
import { formatConfidence } from "./format";

type ContextPanelProps = {
  questions: RefinementQuestion[];
  preferences: Preference[];
  anchors: SearchAnchor[];
  events: WorkspaceEvent[];
  stagedDecision: StagedDecision | null;
  stagedCandidate: ApartmentCandidate | null;
  onAnswer: (question: RefinementQuestion, answer: string) => void;
  onApprovePreference: (id: string) => void;
  onRejectPreference: (id: string) => void;
  onApproveAnchor: (id: string) => void;
  onRejectAnchor: (id: string) => void;
  onUndoDecision: () => void;
};

const sourceLabels = {
  agent_context: "Brought by your agent",
  user_stated: "You said this",
  site_account: "Saved in your account",
};

export function ContextPanel({
  questions,
  preferences,
  anchors,
  events,
  stagedDecision,
  stagedCandidate,
  onAnswer,
  onApprovePreference,
  onRejectPreference,
  onApproveAnchor,
  onRejectAnchor,
  onUndoDecision,
}: ContextPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const pendingPreferences = preferences.filter((preference) => preference.status === "pending");
  const acceptedPreferences = preferences.filter((preference) => preference.status === "approved");
  const pendingAnchors = anchors.filter((anchor) => anchor.status === "pending");
  const acceptedAnchors = anchors.filter((anchor) => anchor.status === "approved");

  return (
    <aside className="context-region" aria-label="Search refinement and approvals">
      {stagedDecision && stagedCandidate ? (
        <section className="decision-review">
          <p className="decision-status"><Sparkles size={13} /> Decision staged</p>
          <h2>{stagedCandidate.name}</h2>
          <p>{stagedDecision.rationale}</p>
          <div className="decision-scope">
            <span>Effect</span>
            <strong>Marks one leading option in this workspace only</strong>
          </div>
          <button className="secondary-button" type="button" onClick={onUndoDecision}>
            <RotateCcw size={15} /> Undo staged decision
          </button>
        </section>
      ) : null}

      <section className="refinement-section">
        <h2>Answer these to enhance and narrow your search</h2>
        <p className="section-intro">You already have results. Answer only what helps.</p>
        <div className="question-list">
          {questions.map((question) => (
            <form
              key={question.id}
              className="question-row"
              onSubmit={(event) => {
                event.preventDefault();
                const answer = answers[question.id]?.trim();
                if (answer) onAnswer(question, answer);
              }}
            >
              <label htmlFor={`answer-${question.id}`}>{question.question}</label>
              <small>{question.reason}</small>
              <div>
                <input
                  id={`answer-${question.id}`}
                  value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Type an answer"
                />
                <button type="submit" aria-label={`Apply answer to ${question.question}`}><Check size={15} /></button>
              </div>
            </form>
          ))}
        </div>
      </section>

      {(pendingPreferences.length + pendingAnchors.length + acceptedPreferences.length + acceptedAnchors.length > 0) ? (
        <details className="approval-section ranking-context">
          <summary>
            <span><Bot size={16} /><strong>Review what shaped this ranking</strong><small>{pendingPreferences.length + pendingAnchors.length} awaiting approval · {acceptedPreferences.length + acceptedAnchors.length} saved</small></span>
            <ChevronDown size={17} />
          </summary>
          <p className="section-intro">Every signal used in this search is shown here. Approve only if you want it remembered.</p>

          {pendingPreferences.map((preference) => (
            <article className="proposal-row" key={preference.id}>
              <div>
                <strong>{preference.label}</strong>
                <span>{sourceLabels[preference.source]} · {formatConfidence(preference.confidence)}</span>
              </div>
              <div className="proposal-actions">
                <button type="button" onClick={() => onRejectPreference(preference.id)} aria-label={`Reject ${preference.label}`}><X size={15} /></button>
                <button className="approve" type="button" onClick={() => onApprovePreference(preference.id)} aria-label={`Approve ${preference.label}`}><Check size={15} /></button>
              </div>
            </article>
          ))}

          {pendingAnchors.map((anchor) => (
            <article className="proposal-row anchor-proposal" key={anchor.id}>
              <MapPin size={16} aria-hidden="true" />
              <div>
                <strong>{anchor.label}</strong>
                <span>{sourceLabels[anchor.source]} · importance {anchor.importance}/5</span>
              </div>
              <div className="proposal-actions">
                <button type="button" onClick={() => onRejectAnchor(anchor.id)} aria-label={`Reject ${anchor.label}`}><X size={15} /></button>
                <button className="approve" type="button" onClick={() => onApproveAnchor(anchor.id)} aria-label={`Approve ${anchor.label}`}><Check size={15} /></button>
              </div>
            </article>
          ))}

          {acceptedPreferences.length + acceptedAnchors.length > 0 ? (
            <div className="accepted-context-list">
              <p>Saved to this workspace</p>
              <div>
                {acceptedPreferences.map((preference) => (
                  <span className="context-chip" key={preference.id}><Check size={12} /> {preference.label}</span>
                ))}
                {acceptedAnchors.map((anchor) => (
                  <span className="context-chip" key={anchor.id}><MapPin size={12} /> {anchor.label}</span>
                ))}
              </div>
            </div>
          ) : null}
        </details>
      ) : (
        <p className="empty-copy">No personal context shaped this search.</p>
      )}

      <details className="activity-log">
        <summary>Agent activity <ChevronDown size={16} /></summary>
        <ol>
          {events.slice(-5).reverse().map((event) => (
            <li key={event.id}>
              {event.source === "agent" ? <Bot size={14} /> : event.source === "system" ? <Clock3 size={14} /> : <Check size={14} />}
              <span><strong>{event.message}</strong><small>{new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
            </li>
          ))}
          {events.length === 0 ? <li><AlertCircle size={14} /><span>No agent actions yet.</span></li> : null}
        </ol>
      </details>
    </aside>
  );
}
