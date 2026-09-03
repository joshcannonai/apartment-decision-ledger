import { useState, type FormEvent } from "react";
import {
  Bot,
  CircleUserRound,
  MapPin,
  Monitor,
  Moon,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import type { SearchStatus } from "../domain/types";
import { nextThemePreference, type ThemePreference } from "../theme";

type SearchHeaderProps = {
  city: string;
  status: SearchStatus;
  note: string;
  hasWorkspace: boolean;
  onSearch: (city: string) => void;
  onReset: () => void;
  onAccount: () => void;
  themePreference: ThemePreference;
  resolvedTheme: "light" | "dark";
  onThemeChange: (preference: ThemePreference) => void;
};

function DecisionMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 5.5h22v21H5zM16 5.5v10.5H5M16 16h11M21.5 16v10.5" />
      <rect x="20" y="20" width="4" height="4" rx="1" />
    </svg>
  );
}

export function SearchHeader({
  city,
  status,
  note,
  hasWorkspace,
  onSearch,
  onReset,
  onAccount,
  themePreference,
  resolvedTheme,
  onThemeChange,
}: SearchHeaderProps) {
  const [cityDraft, setCityDraft] = useState(city);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCity = cityDraft.trim();
    if (nextCity) onSearch(nextCity);
  }

  const ThemeIcon = themePreference === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  const nextTheme = nextThemePreference(themePreference);

  return (
    <header className="site-header">
      <div className="brand-lockup" aria-label="Apartment Ledger home">
        <span className="brand-mark" aria-hidden="true">
          <DecisionMark />
        </span>
        <span>
          <strong>Apartment Ledger</strong>
          <small>Decide with evidence</small>
        </span>
      </div>

      {hasWorkspace ? (
        <form className="city-search" onSubmit={submit} role="search">
          <MapPin size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="city-search">
            City or metro area
          </label>
          <input
            id="city-search"
            name="city"
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder="Search a US city"
            autoComplete="address-level2"
          />
          <button className="primary-button search-button" type="submit" disabled={status === "searching" || !cityDraft.trim()}>
            <Search size={17} aria-hidden="true" />
            {status === "searching" ? "Searching" : "Find apartments"}
          </button>
        </form>
      ) : <span className="header-spacer" aria-hidden="true" />}

      <div className="header-actions">
        <div className="agent-status" title={note || "WebMCP tools share this workspace"}>
          {status === "searching" ? <Sparkles size={15} /> : <Bot size={15} />}
          <span>{status === "searching" ? "Agent searching" : "Agent ready"}</span>
        </div>
        {hasWorkspace ? (
          <button className="icon-button" type="button" onClick={onReset} aria-label="Start over">
            <RotateCcw size={18} />
          </button>
        ) : null}
        <button
          className="theme-control"
          type="button"
          onClick={() => onThemeChange(nextTheme)}
          aria-label={`Theme: ${themePreference}. Click for ${nextTheme}.`}
          title={`Theme: ${themePreference}. Click for ${nextTheme}.`}
        >
          <ThemeIcon size={17} aria-hidden="true" />
        </button>
        <button className="account-button" type="button" onClick={onAccount}>
          <CircleUserRound size={18} />
          <span>Optional sign in</span>
        </button>
      </div>
    </header>
  );
}
