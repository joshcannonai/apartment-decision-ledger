import { Bot, Check, UserRound, X } from "lucide-react";

type OptionalAccountDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function OptionalAccountDialog({ open, onClose }: OptionalAccountDialogProps) {
  if (!open) return null;

  return (
    <div className="account-overlay" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <button className="overlay-scrim" type="button" aria-label="Close account dialog" onClick={onClose} />
      <section className="account-dialog">
        <header>
          <div>
            <p className="eyebrow">Always optional</p>
            <h2 id="account-title">Use this without an account</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>
        <p>Your anonymous workspace stays in this browser. Sign-in is only for durable preferences and cross-device history.</p>
        <ul>
          <li><Check size={15} /> Search and compare without signing in</li>
          <li><Check size={15} /> Approve context before anything is remembered</li>
          <li><Check size={15} /> Clear or reset the workspace at any time</li>
        </ul>
        <button className="provider-button" type="button" disabled>
          <UserRound size={18} /> Continue with Google <span>Not active in demo</span>
        </button>
        <button className="provider-button" type="button" disabled>
          <Bot size={18} /> Continue with ChatGPT <span>Partner access required</span>
        </button>
        <div className="skill-offer">
          <Bot size={18} />
          <div>
            <strong>Apartment workflow skill</strong>
            <p>Optionally teach a compatible agent when to reopen this workspace and which questions to ask.</p>
          </div>
          <button type="button" disabled>Coming later</button>
        </div>
      </section>
    </div>
  );
}
