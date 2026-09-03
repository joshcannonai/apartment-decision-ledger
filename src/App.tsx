import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Building2,
  CheckCircle2,
  FileText,
  List,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { CandidateDetail } from "./components/CandidateDetail";
import { CompareTray } from "./components/CompareTray";
import { ContextPanel } from "./components/ContextPanel";
import { OptionalAccountDialog } from "./components/OptionalAccountDialog";
import { ResultsList } from "./components/ResultsList";
import { SearchHeader } from "./components/SearchHeader";
import { useWorkspace, workspaceActions } from "./domain/store";
import type { RefinementQuestion, SearchQuery, SortOption } from "./domain/types";
import { SLC_DEMO_CANDIDATES } from "./data/slcCandidates";
import { orderCandidateMedia } from "./media/order";
import type { MediaPhase } from "./media/priority";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<"results" | "decision" | "context">("results");
  const [compareOpen, setCompareOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mediaPhase, setMediaPhase] = useState<MediaPhase>("lead");
  const [visibleHeroCount, setVisibleHeroCount] = useState(1);
  const settledShortlistMedia = useRef(new Set<string>());

  useEffect(() => {
    const openComparison = () => setCompareOpen(true);
    window.addEventListener("apartment-ledger:open-comparison", openComparison);
    return () => window.removeEventListener("apartment-ledger:open-comparison", openComparison);
  }, []);

  const visibleCandidates = useMemo(() => {
    const candidatesById = new Map(workspace.candidates.map((candidate) => [candidate.id, candidate]));
    return workspace.visibleCandidateIds
      .map((candidateId) => candidatesById.get(candidateId))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);
  }, [workspace.candidates, workspace.visibleCandidateIds]);

  const selectedCandidate =
    visibleCandidates.find((candidate) => candidate.id === selectedId) ?? visibleCandidates[0] ?? null;
  const comparedCandidates = workspace.comparisonIds
    .map((candidateId) => workspace.candidates.find((candidate) => candidate.id === candidateId))
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);
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

  async function runSearch(city: string, includeDemoContext = false) {
    setMobileSection("results");
    settledShortlistMedia.current.clear();
    setMediaPhase("lead");
    setVisibleHeroCount(1);
    const query: SearchQuery = { city, text: city };
    workspaceActions.prepareSearch(query, includeDemoContext ? demoContext : undefined);
    await workspaceActions.searchCandidates(query);
  }

  function toggleCompare(candidateId: string) {
    const alreadyIncluded = workspace.comparisonIds.includes(candidateId);
    let nextIds: string[];

    if (alreadyIncluded) {
      nextIds = workspace.comparisonIds.filter((id) => id !== candidateId);
    } else if (workspace.comparisonIds.length < 4) {
      nextIds = [...workspace.comparisonIds, candidateId];
    } else {
      nextIds = [...workspace.comparisonIds.slice(1), candidateId];
    }

    workspaceActions.setComparisonSelection(nextIds);
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
    setCompareOpen(false);
    setSelectedId(null);
    setMobileSection("results");
    settledShortlistMedia.current.clear();
    setMediaPhase("lead");
    setVisibleHeroCount(1);
  }

  const hasWorkspace = workspace.query != null || workspace.candidates.length > 0;

  return (
    <div className="app-shell">
      <SearchHeader
        city={workspace.query?.city ?? ""}
        status={workspace.searchStatus}
        note={workspace.searchNote}
        hasWorkspace={hasWorkspace}
        onSearch={(city) => void runSearch(city)}
        onReset={resetWorkspace}
        onAccount={() => setAccountOpen(true)}
      />

      <main>
        {workspace.searchStatus === "idle" && workspace.candidates.length === 0 ? (
          <EmptyWorkspace onSearch={(city) => void runSearch(city)} onDemo={() => void runSearch("Salt Lake City, UT", true)} />
        ) : null}

        {workspace.searchStatus === "searching" && workspace.candidates.length === 0 ? (
          <SearchingState city={workspace.query?.city ?? "your city"} note={workspace.searchNote} />
        ) : null}

        {workspace.searchStatus === "error" ? (
          <ErrorState note={workspace.searchNote} onRetry={() => workspace.query && void runSearch(workspace.query.city)} />
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
              comparisonIds={workspace.comparisonIds}
              sortBy={workspace.sort.by}
              anchors={workspace.anchors.filter((anchor) => anchor.status !== "rejected")}
              sourceNote={workspace.searchNote}
              onSelect={(candidateId) => {
                setSelectedId(candidateId);
                setMobileSection("decision");
              }}
              onToggleCompare={toggleCompare}
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
              comparisonIds={workspace.comparisonIds}
              isStaged={workspace.stagedDecision?.candidateId === selectedCandidate.id}
              onToggleCompare={toggleCompare}
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

      <CompareTray
        candidates={comparedCandidates}
        open={compareOpen}
        onOpen={() => setCompareOpen(true)}
        onClose={() => setCompareOpen(false)}
        onRemove={toggleCompare}
        onSelect={(id) => {
          setSelectedId(id);
          setCompareOpen(false);
          setMobileSection("decision");
        }}
      />

      <OptionalAccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

function EmptyWorkspace({ onSearch, onDemo }: { onSearch: (city: string) => void; onDemo: () => void }) {
  const [city, setCity] = useState("");
  const previewCandidates = ["slc-capitol-reef-206", "slc-swallow-4", "slc-fountain-view-15"]
    .map((id) => SLC_DEMO_CANDIDATES.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);
  const previewLeadMedia = previewCandidates[0] ? orderCandidateMedia(previewCandidates[0].media ?? [])[0] : null;

  return (
    <section className="empty-workspace">
      <div className="empty-hero">
        <h1>Find the apartment that fits your actual life.</h1>
        <p>Start with a city. Your agent can bring what it already knows, while you keep control over what becomes a saved preference.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (city.trim()) onSearch(city.trim());
          }}
        >
          <MapPin size={19} />
          <label className="sr-only" htmlFor="empty-city">City or metro area</label>
          <input id="empty-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Try Salt Lake City, UT" />
          <button className="primary-button" type="submit"><Search size={17} /> Find apartments</button>
        </form>
        <button className="demo-link" type="button" onClick={onDemo}>
          Open the Salt Lake City decision demo
        </button>
      </div>
      <button className="empty-preview" type="button" onClick={onDemo} aria-label="Open the Salt Lake City demo preview">
        <span className="preview-heading">
          <span><strong>Salt Lake City</strong><small>Demo preview · source-linked snapshot</small></span>
          <span>10 options</span>
        </span>
        <span className="preview-lead">
          {previewLeadMedia ? (
            <img src={previewLeadMedia.thumbnailUrl} alt="" loading="eager" fetchPriority="high" />
          ) : null}
          <span>
            <strong>{previewCandidates[0]?.name}</strong>
            <small>{previewCandidates[0] ? `$${previewCandidates[0].allInEstimate.low}–$${previewCandidates[0].allInEstimate.high} all in` : ""}</small>
          </span>
          <b>01</b>
        </span>
        <span className="preview-list">
          {previewCandidates.slice(1).map((candidate, index) => (
            <span key={candidate.id}>
              {orderCandidateMedia(candidate.media ?? [])[0] ? <img src={orderCandidateMedia(candidate.media ?? [])[0].thumbnailUrl} alt="" loading="lazy" /> : <span className="media-skeleton media-skeleton--preview" aria-hidden="true" />}
              <span><strong>{candidate.name}</strong><small>{candidate.neighborhood}</small></span>
              <b>0{index + 2}</b>
            </span>
          ))}
        </span>
        <span className="preview-context">
          <Bot size={15} /> Agent brought: 72-inch desk · Trader Joe’s · character over generic luxury
        </span>
      </button>
      <div className="empty-principles" aria-label="What makes the search different">
        <article><Building2 size={19} /><strong>Results first</strong><span>A broad shortlist appears before follow-up questions.</span></article>
        <article><ShieldCheck size={19} /><strong>Evidence attached</strong><span>Media scope, costs, sources, freshness, and unknowns stay visible.</span></article>
        <article><CheckCircle2 size={19} /><strong>Memory by approval</strong><span>Context can shape this run without being silently saved.</span></article>
      </div>
    </section>
  );
}

function SearchingState({ city, note }: { city: string; note: string }) {
  return (
    <section className="state-page" aria-live="polite">
      <LoaderCircle className="spin" size={24} />
      <h1>Building your {city} shortlist</h1>
      <p>{note || "Normalizing costs, checking evidence, and ranking candidates."}</p>
      <div className="loading-lines" aria-hidden="true"><span /><span /><span /></div>
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
