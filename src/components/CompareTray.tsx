import { Check, Scale, X } from "lucide-react";
import type { ApartmentCandidate } from "../domain/types";
import { formatMoney } from "./format";

type CompareTrayProps = {
  candidates: ApartmentCandidate[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
};

export function CompareTray({ candidates, open, onOpen, onClose, onRemove, onSelect }: CompareTrayProps) {
  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <button className="compare-tray" type="button" onClick={onOpen}>
        <Scale size={18} />
        Compare {candidates.length} {candidates.length === 1 ? "option" : "options"}
        <span>{candidates.length < 2 ? "Add one more" : "Open comparison"}</span>
      </button>
    );
  }

  return (
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-labelledby="compare-title">
      <button className="overlay-scrim" type="button" aria-label="Close comparison" onClick={onClose} />
      <section className="compare-sheet">
        <header>
          <div>
            <p className="eyebrow">Side-by-side evidence</p>
            <h2 id="compare-title">Compare selected apartments</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close comparison"><X size={19} /></button>
        </header>
        <div className="compare-scroll">
          <table>
            <thead>
              <tr>
                <th>Apartment</th>
                {candidates.map((candidate) => (
                  <th key={candidate.id}>
                    <button type="button" onClick={() => onSelect(candidate.id)}>{candidate.name}</button>
                    <button type="button" onClick={() => onRemove(candidate.id)} aria-label={`Remove ${candidate.name} from comparison`}><X size={13} /></button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><th>Recommended</th>{candidates.map((candidate) => <td key={candidate.id}><strong>{candidate.scores.recommended}</strong> / 100</td>)}</tr>
              <tr><th>Market value</th>{candidates.map((candidate) => <td key={candidate.id}>{candidate.scores.marketValue.score} / 100</td>)}</tr>
              <tr><th>Personal fit</th>{candidates.map((candidate) => <td key={candidate.id}>{candidate.scores.personalFit.score} / 100</td>)}</tr>
              <tr><th>Base rent</th>{candidates.map((candidate) => <td key={candidate.id}>{formatMoney(candidate.baseRent)}</td>)}</tr>
              <tr><th>Estimated all in</th>{candidates.map((candidate) => <td key={candidate.id}>{formatMoney(candidate.allInEstimate.low)}–{formatMoney(candidate.allInEstimate.high)}</td>)}</tr>
              <tr><th>Space</th>{candidates.map((candidate) => <td key={candidate.id}>{candidate.squareFeet ?? "Unknown"} sq ft</td>)}</tr>
              <tr><th>Evidence</th>{candidates.map((candidate) => <td key={candidate.id}>Grade {candidate.source.evidenceGrade}</td>)}</tr>
              <tr><th>Unknowns</th>{candidates.map((candidate) => <td key={candidate.id}>{candidate.unknowns.length}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <footer><Check size={15} /> Comparison changes only this workspace. Nothing is sent to a landlord.</footer>
      </section>
    </div>
  );
}
