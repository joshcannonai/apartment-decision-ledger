import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  FileText,
  List,
  LoaderCircle,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { CandidateDetail } from "./components/CandidateDetail";
import { ContextPanel } from "./components/ContextPanel";
import { OptionalAccountDialog } from "./components/OptionalAccountDialog";
import { ResultsList } from "./components/ResultsList";
import { SearchHeader } from "./components/SearchHeader";
import { useWorkspace, workspaceActions } from "./domain/store";
import type { RefinementQuestion, RentalType, SearchQuery, SortOption } from "./domain/types";
import type { MediaPhase } from "./media/priority";
import { useThemePreference } from "./theme";

const demoContext = {
  preferences: [
    {
      kind: "budget" as const,
      label: "Keep the estimated all-in cost near $1,900",
      value: 1900,
      source: "agent_context" as const,
      confidence: 0.9,
    },
    {
      kind: "furniture" as const,
      label: "Needs a workable place for a 72-inch desk",
      value: "72-inch desk",
      source: "agent_context" as const,
      confidence: 0.96,
    },
    {
      kind: "lifestyle" as const,
      label: "Prefers character over generic luxury finishes",
      value: "historic or distinctive design",
      source: "agent_context" as const,
      confidence: 0.78,
    },
  ],
  anchors: [
    {
      label: "Trader Joe's Salt Lake City",
      importance: 4 as const,
      latitude: 40.7584,
      longitude: -111.8677,
      source: "agent_context" as const,
      confidence: 0.82,
    },
    {
      label: "Downtown Salt Lake City",
      importance: 3 as const,
      latitude: 40.7608,
      longitude: -111.891,
      source: "agent_context" as const,
      confidence: 0.7,
    },
  ],
  customQuestions: [
    {
      question: "Would carrying the 72-inch desk up stairs rule out a walk-up?",
      reason: "Your agent flagged a large desk; elevator and stair access could change otherwise strong options.",
      kind: "furniture" as const,
    },
  ],
};

export function App() {
  const workspace = useWorkspace();
  const theme = useThemePreference();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<"results" | "decision" | "context">("results");
  const [accountOpen, setAccountOpen] = useState(false);
  const [mediaPhase, setMediaPhase] = useState<MediaPhase>("lead");
  const [visibleHeroCount, setVisibleHeroCount] = useState(1);
  const settledShortlistMedia = useRef(new Set<string>());

  const visibleCandidates = useMemo(() => {
    const candidatesById = new Map(workspace.candidates.map((candidate) => [candidate.id, candidate]));
    return workspace.visibleCandidateIds
      .map((candidateId) => candidatesById.get(candidateId))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);
  }, [workspace.candidates, workspace.visibleCandidateIds]);

  const selectedCandidate =
    visibleCandidates.find((candidate) => candidate.id === selectedId) ?? visibleCandidates[0] ?? null;
  const stagedCandidate = workspace.stagedDecision
    ? workspace.candidates.find((candidate) => candidate.id === workspace.stagedDecision?.candidateId) ?? null
    : null;
  const readyRuns = workspace.searchRuns.filter((run) => run.status === "ready");
  const activeRunIndex = readyRuns.findIndex((run) => run.number === workspace.activeRunNumber);
  const activeRun = activeRunIndex >= 0 ? readyRuns[activeRunIndex] : null;
  const previousRun = activeRunIndex > 0 ? readyRuns[activeRunIndex - 1] : null;
  const selectedPreviousRank = previousRun && selectedCandidate
    ? previousRun.candidates.findIndex((candidate) => candidate.id === selectedCandidate.id)
    : -1;

  useEffect(() => {
    if (visibleCandidates.length === 0) return;
    if (mediaPhase === "lead") {
      const fallback = window.setTimeout(() => {
        setVisibleHeroCount(Math.min(5, visibleCandidates.length));
        setMediaPhase("shortlist");
      }, 1600);
      return () => window.clearTimeout(fallback);
    }
    if (mediaPhase === "shortlist") {
      const fallback = window.setTimeout(() => setMediaPhase("gallery"), 2200);
      return () => window.clearTimeout(fallback);
    }
    if (mediaPhase === "gallery") {
      const loadBackground = () => {
        setVisibleHeroCount((current) => Math.max(current, Math.min(6, visibleCandidates.length)));
        setMediaPhase("background");
      };
      const firstBackgroundHero = window.setTimeout(loadBackground, 420);
      return () => window.clearTimeout(firstBackgroundHero);
    }
    if (mediaPhase === "background" && visibleHeroCount < visibleCandidates.length) {
      const nextHero = window.setTimeout(
        () => setVisibleHeroCount((current) => Math.min(current + 1, visibleCandidates.length)),
        260,
      );
      return () => window.clearTimeout(nextHero);
    }
  }, [mediaPhase, visibleCandidates.length, visibleHeroCount]);

  function handleMediaSettled(candidateId: string, mediaIndex: number, rank: number) {
    if (mediaIndex !== 0) return;

    if (rank === 0) {
      setVisibleHeroCount((current) => Math.max(current, Math.min(5, visibleCandidates.length)));
      setMediaPhase((current) => current === "lead" ? "shortlist" : current);
    }
    if (rank >= 5) return;

    settledShortlistMedia.current.add(candidateId);
    const expected = visibleCandidates.slice(0, 5).filter((candidate) => (candidate.media?.length ?? 0) > 0).length;
    if (expected > 0 && settledShortlistMedia.current.size >= expected) {
      setMediaPhase((current) => current === "lead" || current === "shortlist" ? "gallery" : current);
    }
  }

  async function runSearch(input: string | SearchQuery, includeDemoContext = false) {
    setMobileSection("results");
    settledShortlistMedia.current.clear();
    setMediaPhase("lead");
    setVisibleHeroCount(1);
    const query: SearchQuery = typeof input === "string" ? { city: input, text: input } : input;
    workspaceActions.prepareSearch(query, includeDemoContext ? demoContext : undefined);
    await workspaceActions.searchCandidates(query);
  }

  function organizeResults(by: SortOption) {
    const ascending = ["all_in_cost", "base_rent", "distance"].includes(by);
    workspaceActions.organizeResults({
      by,
      anchorId: by === "distance" ? workspace.anchors.find((anchor) => anchor.status === "approved")?.id ?? workspace.anchors[0]?.id ?? null : null,
      direction: ascending ? "asc" : "desc",
    });
  }

  function answerQuestion(question: RefinementQuestion, answer: string) {
    const kind = question.kind;
    const numericValue = Number(answer.replace(/[^0-9.]/g, ""));
    workspaceActions.queueRefinementAnswer(question.id, {
      kind,
      label: `${question.question} ${answer}`,
      value: ["budget", "bedrooms", "minimum_space"].includes(kind)
        ? (Number.isFinite(numericValue) && numericValue > 0 ? numericValue : answer)
        : answer,
      source: "user_stated",
      confidence: 1,
    });
  }

  async function rerunSearch() {
    if (!workspace.query || workspace.searchStatus === "searching") return;
    await workspaceActions.searchCandidates(workspace.query);
  }

  function resetWorkspace() {
    workspaceActions.resetWorkspace();
    setSelectedId(null);
    setMobileSection("results");
    settledShortlistMedia.current.clear();
    setMediaPhase("lead");
    setVisibleHeroCount(1);
  }

  const hasWorkspace = workspace.candidates.length > 0;

  return (
    <div className="app-shell">
      <SearchHeader
        key={workspace.query?.city ?? "new-ledger"}
        city={workspace.query?.city ?? ""}
        status={workspace.searchStatus}
        note={workspace.searchNote}
        hasWorkspace={hasWorkspace}
        onSearch={(city) => void runSearch(city)}
        onReset={resetWorkspace}
        onAccount={() => setAccountOpen(true)}
        themePreference={theme.preference}
        resolvedTheme={theme.resolved}
        onThemeChange={theme.setPreference}
      />

      <main>
        {workspace.searchStatus === "idle" && workspace.candidates.length === 0 ? (
          <EmptyWorkspace
            key={JSON.stringify(workspace.query) ?? "new-ledger"}
            initialQuery={workspace.query}
            proposedPreferences={workspace.preferences.filter((item) => item.status === "pending").map((item) => item.label)}
            proposedAnchors={workspace.anchors.filter((item) => item.status === "pending").map((item) => item.label)}
            onSearch={(query) => void runSearch(query)}
            onDemo={() => void runSearch("Salt Lake City, UT", true)}
          />
        ) : null}

        {workspace.searchStatus === "searching" && workspace.candidates.length === 0 ? (
          <SearchingState city={workspace.query?.city ?? "your city"} note={workspace.searchNote} />
        ) : null}

        {workspace.searchStatus === "error" ? (
          <ErrorState note={workspace.searchNote} onRetry={() => workspace.query && void runSearch(workspace.query.city)} />
        ) : null}

        {workspace.searchStatus === "ready" && workspace.candidates.length === 0 && workspace.query ? (
          <EmptyWorkspace
            initialQuery={workspace.query}
            unavailableNote={workspace.searchNote}
            proposedPreferences={workspace.preferences.filter((item) => item.status === "pending").map((item) => item.label)}
            proposedAnchors={workspace.anchors.filter((item) => item.status === "pending").map((item) => item.label)}
            onSearch={(query) => void runSearch(query)}
            onDemo={() => void runSearch("Salt Lake City, UT", true)}
          />
        ) : null}

        {workspace.searchStatus !== "error" && workspace.candidates.length > 0 && visibleCandidates.length === 0 ? (
          <NoMatches onResetSort={() => workspaceActions.organizeResults({ by: "recommended", direction: "desc" })} />
        ) : null}

        {visibleCandidates.length > 0 && selectedCandidate ? (
          <div className={`workspace-layout workspace-${mobileSection}`}>
            <nav className="mobile-workspace-nav" aria-label="Apartment workspace sections">
              <button
                type="button"
                className={mobileSection === "results" ? "is-active" : ""}
                aria-current={mobileSection === "results" ? "page" : undefined}
                onClick={() => setMobileSection("results")}
              >
                <List size={16} /> Results
              </button>
              <button
                type="button"
                className={mobileSection === "decision" ? "is-active" : ""}
                aria-current={mobileSection === "decision" ? "page" : undefined}
                onClick={() => setMobileSection("decision")}
              >
                <FileText size={16} /> Decision
              </button>
              <button
                type="button"
                className={mobileSection === "context" ? "is-active" : ""}
                aria-current={mobileSection === "context" ? "page" : undefined}
                onClick={() => setMobileSection("context")}
              >
                <SlidersHorizontal size={16} /> Refine
              </button>
            </nav>
            <ResultsList
              candidates={visibleCandidates}
              selectedId={selectedCandidate.id}
              sortBy={workspace.sort.by}
              anchors={workspace.anchors.filter((anchor) => anchor.status !== "rejected")}
              sourceNote={workspace.searchNote}
              onSelect={(candidateId) => {
                setSelectedId(candidateId);
                setMobileSection("decision");
              }}
              onSort={organizeResults}
              mediaPhase={mediaPhase}
              visibleHeroCount={visibleHeroCount}
              onMediaSettled={handleMediaSettled}
              searchRuns={workspace.searchRuns}
              activeRunNumber={workspace.activeRunNumber}
              onSelectRun={(runNumber) => workspaceActions.selectSearchRun(runNumber)}
            />
            <CandidateDetail
              candidate={selectedCandidate}
              isStaged={workspace.stagedDecision?.candidateId === selectedCandidate.id}
              onStage={(candidateId) => {
                workspaceActions.stageDecision({
                  candidateId,
                  rationale: `${selectedCandidate.name} currently has the strongest balance of verified cost, market value, and personal fit. Review its unknowns before contacting the property.`,
                  stagedBy: "human",
                });
              }}
              onAddLocation={(label) => {
                setSelectedId(selectedCandidate.id);
                return workspaceActions.addLocationAnchor(label);
              }}
              onSortByLocation={(anchorId) => {
                setSelectedId(selectedCandidate.id);
                workspaceActions.organizeResults({ by: "distance", anchorId, direction: "asc" });
              }}
              onFocusLocation={(anchorId) => workspaceActions.focusLocationAnchor(anchorId)}
              focusedAnchorId={workspace.focusedAnchorId}
              rank={Math.max(0, visibleCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id))}
              runContext={{
                number: activeRun?.number ?? 1,
                previousCandidate: previousRun?.candidates.find((candidate) => candidate.id === selectedCandidate.id) ?? null,
                previousRank: selectedPreviousRank >= 0 ? selectedPreviousRank : null,
                triggerLabels: activeRun?.triggerLabels ?? [],
              }}
              mediaPhase={mediaPhase}
              onMediaSettled={handleMediaSettled}
            />
            <ContextPanel
              questions={workspace.refinementQuestions}
              preferences={workspace.preferences}
              anchors={workspace.anchors}
              events={workspace.events}
              stagedDecision={workspace.stagedDecision}
              stagedCandidate={stagedCandidate}
              onAnswer={answerQuestion}
              onRerun={() => void rerunSearch()}
              isRerunning={workspace.searchStatus === "searching"}
              onApprovePreference={(id) => workspaceActions.approvePreferences([id])}
              onRejectPreference={(id) => workspaceActions.rejectPreferences([id])}
              onApproveAnchor={(id) => workspaceActions.approvePreferences([id])}
              onRejectAnchor={(id) => workspaceActions.rejectPreferences([id])}
              onUndoDecision={() => workspaceActions.undoStageDecision()}
            />
          </div>
        ) : null}
      </main>

      <OptionalAccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

function EmptyWorkspace({
  initialQuery,
  unavailableNote,
  proposedPreferences,
  proposedAnchors,
  onSearch,
  onDemo,
}: {
  initialQuery: SearchQuery | null;
  unavailableNote?: string;
  proposedPreferences: string[];
  proposedAnchors: string[];
  onSearch: (query: SearchQuery) => void;
  onDemo: () => void;
}) {
  const initialLocation = [initialQuery?.city, initialQuery?.state].filter(Boolean).join(", ");
  const [city, setCity] = useState(initialLocation);
  const [maxAllIn, setMaxAllIn] = useState(initialQuery?.maxAllIn?.toString() ?? "");
  const [minBedrooms, setMinBedrooms] = useState(initialQuery?.minBedrooms?.toString() ?? "");
  const [rentalType, setRentalType] = useState<RentalType>(initialQuery?.rentalType ?? "whole_place");
  const [moveWindow, setMoveWindow] = useState(initialQuery?.moveWindow ?? "");
  const [sharedContextSummary, setSharedContextSummary] = useState(initialQuery?.sharedContextSummary ?? "");
  const [budgetRationale, setBudgetRationale] = useState(initialQuery?.budgetRationale ?? "");
  const [request, setRequest] = useState(initialQuery?.text ?? "");
  const proposedContext = [...proposedPreferences, ...proposedAnchors];
  const displayCity = initialLocation || city;

  return (
    <section className={`empty-workspace${unavailableNote ? " has-unavailable-note" : ""}`}>
      <form
        className="ledger-entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          const locationMatch = city.trim().match(/^(.*?),\s*([A-Za-z]{2})$/);
          const cityName = locationMatch?.[1]?.trim() || city.trim();
          if (!cityName) return;
          onSearch({
            city: cityName,
            state: locationMatch?.[2]?.toUpperCase() || initialQuery?.state,
            rentalType,
            maxAllIn: maxAllIn ? Number(maxAllIn) : undefined,
            minBedrooms: minBedrooms ? Number(minBedrooms) : undefined,
            moveWindow: moveWindow.trim() || undefined,
            sharedContextSummary: sharedContextSummary.trim() || undefined,
            budgetRationale: budgetRationale.trim() || undefined,
            text: request.trim() || city.trim(),
          });
        }}
      >
        <div className="empty-hero">
          {unavailableNote ? <p className="eyebrow">Search needs a live source</p> : <p className="eyebrow"><Bot size={13} /> Agent-ready apartment search</p>}
          <h1 aria-label={unavailableNote ? `${displayCity} is ready. Inventory source needed.` : "Find a place that fits."}>
            {unavailableNote ? (
              <><span>{displayCity} is ready.</span><span>Inventory source needed.</span></>
            ) : (
              <span>Find a place that fits.</span>
            )}
          </h1>
          <p>{unavailableNote
            ? "The search is prepared, but live apartment inventory is not connected yet. Open the verified Salt Lake City demo or connect the listing provider for real candidates."
            : "Set the essentials yourself, or let your agent bring the apartment context it already has."}</p>
        </div>

        <section className="agent-prefill-panel" aria-labelledby="agent-prefill-heading">
          <header>
            <div>
              <span>Apartment search</span>
              <h2 id="agent-prefill-heading">Start with the essentials</h2>
            </div>
            <small><Bot size={13} /> Agent-fillable</small>
          </header>
          <label className="city-field-label" htmlFor="empty-city">Where do you want to live?</label>
          <div className="city-entry-row">
            <MapPin size={18} />
            <input id="empty-city" data-agent-field="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="City and state, like Denver, CO" autoComplete="address-level2" />
          </div>
          <div className="agent-field-grid">
            <label><span>Rental type</span><select data-agent-field="rental-type" value={rentalType} onChange={(event) => setRentalType(event.target.value as RentalType)}><option value="any">Any rental</option><option value="whole_place">Whole place</option><option value="private_room">Private room</option><option value="shared_room">Shared room</option></select></label>
            <label><span>Maximum all-in cost</span><input data-agent-field="max-all-in" type="number" min="300" step="50" value={maxAllIn} onChange={(event) => setMaxAllIn(event.target.value)} placeholder="No maximum" /></label>
            <label><span>Minimum bedrooms</span><select data-agent-field="minimum-bedrooms" value={minBedrooms} onChange={(event) => setMinBedrooms(event.target.value)}><option value="">Any</option><option value="0">Studio</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select></label>
            <label><span>Move window</span><input data-agent-field="move-window" value={moveWindow} onChange={(event) => setMoveWindow(event.target.value)} placeholder="For example, October" /></label>
            <div className="context-divider"><span>Personal context</span><small>Optional</small></div>
            <label><span>Anything else that matters</span><input data-agent-field="request" value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Desk, pet, parking, neighborhood..." /></label>
            <label><span>Why this budget</span><input data-agent-field="budget-rationale" value={budgetRationale} onChange={(event) => setBudgetRationale(event.target.value)} placeholder="Your agent can explain its suggestion" /></label>
            <label className="agent-field-full"><span>Relevant context from your agent</span><textarea data-agent-field="shared-context" value={sharedContextSummary} onChange={(event) => setSharedContextSummary(event.target.value)} placeholder="Only apartment-related details, such as living alone, furniture, or important places." /></label>
          </div>
          {proposedContext.length > 0 ? (
            <div className="agent-proposal-preview" aria-label="Context proposed by your agent">
              <strong>Added by your agent</strong>
              <div>{proposedContext.slice(0, 4).map((label) => <span key={label}>{label}</span>)}</div>
            </div>
          ) : null}
          <footer className="entry-actions">
            <p className="entry-privacy"><Bot size={14} /> Only context shown here reaches Apartment Ledger. Nothing becomes a saved preference without your approval.</p>
            <div>
              <button className="demo-link" type="button" onClick={onDemo}>Use Salt Lake City demo</button>
              <button className="primary-button" type="submit" disabled={!city.trim()}><Search size={17} /> Find apartments</button>
            </div>
          </footer>
        </section>
      </form>
    </section>
  );
}

function SearchingState({ city, note }: { city: string; note: string }) {
  const sources = /salt lake/i.test(city)
    ? ["Source-linked SLC snapshot", "Property manager records", "Public listing records"]
    : ["Connected rental inventory", "Available source records", "Listing evidence"];
  return (
    <section className="state-page search-thinking" aria-live="polite">
      <div className="thinking-orbit" aria-hidden="true"><LoaderCircle className="spin" size={24} /><span /><span /></div>
      <p className="eyebrow">Agent search in progress</p>
      <h1>Building your {city} shortlist</h1>
      <p>{note || "Checking connected inventory, normalizing costs, and matching each option to your life."}</p>
      <div className="source-thinking" aria-label="Search sources and ranking stages">
        {sources.map((source, index) => <span style={{ animationDelay: `${index * 180}ms` }} key={source}><Search size={13} /> {source}</span>)}
      </div>
      <div className="thinking-steps" aria-hidden="true"><span>Normalize all-in cost</span><span>Score market value</span><span>Match personal fit</span><span>Rank best options</span></div>
    </section>
  );
}

function ErrorState({ note, onRetry }: { note: string; onRetry: () => void }) {
  return (
    <section className="state-page error-page">
      <AlertCircle size={24} />
      <h1>We could not finish this search.</h1>
      <p>{note || "The workspace is still safe. Try the search again."}</p>
      <button className="primary-button" type="button" onClick={onRetry}>Retry search</button>
    </section>
  );
}

function NoMatches({ onResetSort }: { onResetSort: () => void }) {
  return (
    <section className="state-page">
      <Search size={24} />
      <h1>Your current organization hid every result.</h1>
      <p>The underlying candidates are still in this workspace.</p>
      <button className="secondary-button" type="button" onClick={onResetSort}>Show recommended results</button>
    </section>
  );
}
