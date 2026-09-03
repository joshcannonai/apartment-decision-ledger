import { useSyncExternalStore } from "react";
import { SLC_DEMO_CANDIDATES } from "../data/slcCandidates";
import { resolveKnownAnchor } from "./geo";
import { scoreCandidates, sortCandidates } from "./scoring";
import type {
  AddCandidateInput,
  ApartmentCandidate,
  ExternalCandidate,
  Preference,
  PreferenceProposalInput,
  RefinementQuestion,
  SearchAnchor,
  SearchClient,
  SearchQuery,
  SortOption,
  StagedDecision,
  WorkspaceEvent,
  WorkspaceState,
} from "./types";

const STORAGE_KEY = "apartment-decision-ledger.workspace.v1";
const MAX_EVENTS = 30;
const CURRENT_DEMO_BY_ID = new Map(SLC_DEMO_CANDIDATES.map((candidate) => [candidate.id, candidate]));

type Listener = () => void;
type EventListener = (event: WorkspaceEvent) => void;

export type SearchOutcome = {
  resultCount: number;
  topCandidateIds: string[];
  sourceMode: "live_search" | "curated_demo" | "no_results";
  note: string;
  refinementQuestionCount: number;
  refinementQuestions: Array<{ id: string; question: string; reason: string }>;
  runNumber: number;
};

const now = () => new Date().toISOString();

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function initialState(): WorkspaceState {
  const timestamp = now();
  return {
    version: 1,
    sessionId: createId("anon"),
    query: null,
    searchStatus: "idle",
    searchNote: "Start with a city. Results appear before optional refinement questions.",
    candidates: [],
    visibleCandidateIds: [],
    preferences: [],
    anchors: [],
    focusedAnchorId: null,
    sort: { by: "recommended", anchorId: null, direction: "desc" },
    refinementQuestions: [],
    customRefinementQuestions: [],
    answeredQuestionIds: [],
    queuedRefinementLabels: [],
    searchRuns: [],
    activeRunNumber: null,
    comparisonIds: [],
    stagedDecision: null,
    decisionHistory: [],
    events: [],
    lastUpdatedAt: timestamp,
  };
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceState>;
  return (
    candidate.version === 1 &&
    typeof candidate.sessionId === "string" &&
    Array.isArray(candidate.candidates) &&
    Array.isArray(candidate.preferences) &&
    Array.isArray(candidate.anchors) &&
    Array.isArray(candidate.events)
  );
}

export function refreshCuratedDemoMedia(candidates: ApartmentCandidate[]) {
  return candidates.map((candidate) => {
    if (candidate.addedBy !== "curated_demo") return candidate;
    const currentDemo = CURRENT_DEMO_BY_ID.get(candidate.id);
    if (!currentDemo) return candidate;
    return {
      ...candidate,
      media: currentDemo.media?.map((item) => ({ ...item })),
    };
  });
}

function loadPersistedState() {
  if (typeof window === "undefined") return null;
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (!isWorkspaceState(parsed)) return null;
    return {
      ...initialState(),
      ...parsed,
      candidates: refreshCuratedDemoMedia(parsed.candidates),
      customRefinementQuestions: parsed.customRefinementQuestions ?? [],
      answeredQuestionIds: parsed.answeredQuestionIds ?? [],
      queuedRefinementLabels: parsed.queuedRefinementLabels ?? [],
      searchRuns: (parsed.searchRuns ?? []).map((run) => ({
        ...run,
        candidates: refreshCuratedDemoMedia(run.candidates),
      })),
      activeRunNumber: parsed.activeRunNumber ?? null,
    };
  } catch {
    return null;
  }
}

let state = loadPersistedState() ?? initialState();
const serverSnapshot = initialState();
const listeners = new Set<Listener>();
const eventListeners = new Set<EventListener>();
let configuredSearchClient: SearchClient | null = null;

function persist(next: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    const persisted = next.query ? {
      ...next,
      query: {
        ...next.query,
        sharedContextSummary: undefined,
        budgetRationale: undefined,
      },
    } : next;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Anonymous persistence is best effort; a storage-disabled browser still works.
  }
}

function commit(
  nextOrUpdater: WorkspaceState | ((current: WorkspaceState) => WorkspaceState),
  event?: Omit<WorkspaceEvent, "id" | "at">,
) {
  const next = typeof nextOrUpdater === "function" ? nextOrUpdater(state) : nextOrUpdater;
  let emitted: WorkspaceEvent | null = null;
  if (event) {
    emitted = { ...event, id: createId("event"), at: now() };
  }
  state = {
    ...next,
    events: emitted ? [...next.events, emitted].slice(-MAX_EVENTS) : next.events,
    lastUpdatedAt: now(),
  };
  persist(state);
  for (const listener of listeners) listener();
  if (emitted) for (const listener of eventListeners) listener(emitted);
}

function cloneCandidates(candidates: ApartmentCandidate[]) {
  return candidates.map((candidate) => ({
    ...candidate,
    features: [...candidate.features],
    unknowns: [...candidate.unknowns],
    distances: candidate.distances.map((distance) => ({ ...distance })),
    scores: {
      marketValue: { ...candidate.scores.marketValue },
      personalFit: {
        ...candidate.scores.personalFit,
        matched: [...candidate.scores.personalFit.matched],
        tensions: [...candidate.scores.personalFit.tensions],
        unknowns: [...candidate.scores.personalFit.unknowns],
      },
      recommended: candidate.scores.recommended,
    },
    source: { ...candidate.source },
    media: candidate.media?.map((item) => ({ ...item })),
    allInEstimate: { ...candidate.allInEstimate },
  }));
}

function normalizeQuery(query: SearchQuery): SearchQuery {
  const city = query.city.trim();
  if (!city) throw new Error("A city is required to start an apartment search.");
  if (city.length > 100) throw new Error("City must be 100 characters or fewer.");
  if (query.maxAllIn != null && (!Number.isFinite(query.maxAllIn) || query.maxAllIn < 300)) {
    throw new Error("Maximum all-in cost must be a realistic positive monthly amount.");
  }
  if (
    query.minBedrooms != null &&
    (!Number.isInteger(query.minBedrooms) || query.minBedrooms < 0 || query.minBedrooms > 10)
  ) {
    throw new Error("Minimum bedrooms must be a whole number from 0 to 10.");
  }
  return {
    city,
    state: query.state?.trim().slice(0, 40) || undefined,
    rentalType: query.rentalType ?? "any",
    maxAllIn: query.maxAllIn,
    minBedrooms: query.minBedrooms,
    moveWindow: query.moveWindow?.trim().slice(0, 160) || undefined,
    sharedContextSummary: query.sharedContextSummary?.trim().slice(0, 1200) || undefined,
    budgetRationale: query.budgetRationale?.trim().slice(0, 280) || undefined,
    text: query.text?.trim().slice(0, 500) || undefined,
  };
}

function proposalRecords(input: PreferenceProposalInput) {
  const preferences: Preference[] = (input.preferences ?? []).slice(0, 20).map((preference) => ({
    id: createId("preference"),
    kind: preference.kind,
    label: preference.label.trim().slice(0, 160),
    value: preference.value,
    source: preference.source ?? "agent_context",
    confidence: Math.max(0, Math.min(1, preference.confidence ?? 0.8)),
    status: "pending",
    affectsCurrentSearch: true,
    createdAt: now(),
  }));

  const anchors: SearchAnchor[] = (input.anchors ?? []).slice(0, 10).map((anchor) => {
    const label = anchor.label.trim().slice(0, 160);
    const known = resolveKnownAnchor(label);
    const latitude = known?.latitude ?? anchor.latitude ?? null;
    const longitude = known?.longitude ?? anchor.longitude ?? null;
    if ((latitude == null) !== (longitude == null)) {
      throw new Error(`Location anchor “${label}” needs both latitude and longitude or neither.`);
    }
    if (
      (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      throw new Error(`Location anchor “${label}” has invalid coordinates.`);
    }
    return {
      id: createId("anchor"),
      label,
      latitude,
      longitude,
      importance: anchor.importance ?? 3,
      source: anchor.source ?? "agent_context",
      confidence: Math.max(0, Math.min(1, anchor.confidence ?? 0.75)),
      status: "pending",
      verification: known
        ? "verified_coordinates"
        : latitude != null && longitude != null
          ? "agent_supplied_coordinates"
          : "needs_coordinates",
    };
  });

  if (preferences.some((preference) => !preference.label)) {
    throw new Error("Every proposed preference needs a visible label.");
  }
  if (anchors.some((anchor) => !anchor.label)) {
    throw new Error("Every proposed location anchor needs a visible label.");
  }
  const customQuestions: RefinementQuestion[] = (input.customQuestions ?? []).slice(0, 8).map((question) => ({
    id: createId("custom-question"),
    question: question.question.trim().slice(0, 180),
    reason: question.reason.trim().slice(0, 220),
    blocking: false,
    kind: question.kind ?? "other",
    origin: "agent_custom",
  }));
  if (customQuestions.some((question) => !question.question || !question.reason)) {
    throw new Error("Every custom refinement question needs visible question and reason text.");
  }
  return { preferences, anchors, customQuestions };
}

function mergeProposals(current: WorkspaceState, input: PreferenceProposalInput) {
  const proposed = proposalRecords(input);
  const existingPreferenceKeys = new Set(
    current.preferences.map((preference) => `${preference.kind}:${preference.label.toLowerCase()}`),
  );
  const existingAnchorKeys = new Set(current.anchors.map((anchor) => anchor.label.toLowerCase()));
  const existingQuestionKeys = new Set(
    current.customRefinementQuestions.map((question) => question.question.toLowerCase()),
  );
  return {
    preferences: [
      ...current.preferences,
      ...proposed.preferences.filter(
        (preference) =>
          !existingPreferenceKeys.has(`${preference.kind}:${preference.label.toLowerCase()}`),
      ),
    ],
    anchors: [
      ...current.anchors,
      ...proposed.anchors.filter((anchor) => !existingAnchorKeys.has(anchor.label.toLowerCase())),
    ],
    customRefinementQuestions: [
      ...current.customRefinementQuestions,
      ...proposed.customQuestions.filter(
        (question) => !existingQuestionKeys.has(question.question.toLowerCase()),
      ),
    ],
  };
}

function questionsFor(current: WorkspaceState) {
  const questions: RefinementQuestion[] = [];
  const answered = new Set(current.answeredQuestionIds);
  const activePreferences = current.preferences.filter((preference) => preference.status !== "rejected");
  if (
    !answered.has("refine-budget") &&
    current.query?.maxAllIn == null &&
    !activePreferences.some((preference) => preference.kind === "budget")
  ) {
    questions.push({
      id: "refine-budget",
      question: "What monthly all-in range would feel comfortable?",
      reason: "This separates a low advertised rent from the amount you would actually pay.",
      blocking: false as const,
      kind: "budget",
      origin: "base",
    });
  }
  if (!answered.has("refine-anchors") && !current.anchors.some((anchor) => anchor.status !== "rejected")) {
    questions.push({
      id: "refine-anchors",
      question: "Which two or three places should be easiest to reach each week?",
      reason: "Work, groceries, transit, family or a favorite neighborhood can change the ranking.",
      blocking: false as const,
      kind: "lifestyle",
      origin: "base",
    });
  }
  if (
    !answered.has("refine-space") &&
    current.query?.minBedrooms == null &&
    !activePreferences.some(
      (preference) => ["bedrooms", "minimum_space", "furniture"].includes(preference.kind),
    )
  ) {
    questions.push({
      id: "refine-space",
      question: "Do you need a separate office or space for any large furniture?",
      reason: "A listing can fit the budget while failing the physical-layout test.",
      blocking: false as const,
      kind: "furniture",
      origin: "base",
    });
  }
  if (
    !answered.has("refine-move") &&
    !current.query?.moveWindow &&
    !activePreferences.some((preference) => preference.kind === "lease")
  ) {
    questions.push({
      id: "refine-move",
      question: "When would you ideally move, and how flexible is that date?",
      reason: "Availability changes quickly and may exclude an otherwise strong match.",
      blocking: false as const,
      kind: "lease",
      origin: "base",
    });
  }
  const hasSignal = (pattern: RegExp) => activePreferences.some(
    (preference) => pattern.test(`${preference.label} ${String(preference.value)}`),
  );
  if (!answered.has("refine-pets") && !hasSignal(/pet|dog|cat/i)) {
    questions.push({
      id: "refine-pets",
      question: "Will any pets live with you?",
      reason: "Pet rules and monthly fees can change both fit and all-in cost.",
      blocking: false,
      kind: "amenity",
      origin: "base",
    });
  }
  if (!answered.has("refine-transport") && !hasSignal(/parking|transit|car|bike/i)) {
    questions.push({
      id: "refine-transport",
      question: "Do you need parking, transit access, or secure bike storage?",
      reason: "Transportation needs can reorder otherwise similar apartments.",
      blocking: false,
      kind: "amenity",
      origin: "base",
    });
  }
  if (!answered.has("refine-noise") && !hasSignal(/quiet|noise|street|night/i)) {
    questions.push({
      id: "refine-noise",
      question: "How important is a quiet home, especially at night?",
      reason: "Street exposure, nightlife and building construction can create a meaningful tradeoff.",
      blocking: false,
      kind: "lifestyle",
      origin: "base",
    });
  }

  const custom = current.customRefinementQuestions.filter(
    (question) => !answered.has(question.id),
  );
  return [...custom, ...questions].slice(0, 4);
}

function defaultDirection(by: SortOption) {
  return by === "all_in_cost" || by === "base_rent" || by === "distance" ? "asc" : "desc";
}

function queryPreferences(query: SearchQuery | null): Preference[] {
  if (!query) return [];
  const createdAt = now();
  const preferences: Preference[] = [];
  if (query.maxAllIn != null) {
    preferences.push({
      id: "current-query-budget",
      kind: "budget",
      label: `All-in cost at or below $${query.maxAllIn.toLocaleString()}`,
      value: query.maxAllIn,
      source: "user_stated",
      confidence: 1,
      status: "approved",
      affectsCurrentSearch: true,
      createdAt,
    });
  }
  if (query.minBedrooms != null) {
    preferences.push({
      id: "current-query-bedrooms",
      kind: "bedrooms",
      label: `At least ${query.minBedrooms} bedroom${query.minBedrooms === 1 ? "" : "s"}`,
      value: query.minBedrooms,
      source: "user_stated",
      confidence: 1,
      status: "approved",
      affectsCurrentSearch: true,
      createdAt,
    });
  }
  return preferences;
}

function recomputeAndSort(current: WorkspaceState, candidates: ApartmentCandidate[]) {
  const scored = scoreCandidates(
    candidates,
    [...current.preferences, ...queryPreferences(current.query)],
    current.anchors,
  );
  return sortCandidates(scored, current.sort.by, current.sort.direction, current.sort.anchorId);
}

function prepareSearch(query: SearchQuery, context?: PreferenceProposalInput) {
  const normalized = normalizeQuery(query);
  commit(
    (current) => {
      const merged = context ? mergeProposals(current, context) : current;
      const next = {
        ...current,
        ...merged,
        focusedAnchorId: merged.anchors.at(-1)?.id ?? current.focusedAnchorId,
        query: normalized,
        searchNote: "Search prepared. Results can run now; unanswered questions will refine them later.",
      };
      const candidates = recomputeAndSort(next, next.candidates);
      return { ...next, candidates, visibleCandidateIds: candidates.map((candidate) => candidate.id) };
    },
    {
      type: "search_prepared",
      source: "agent",
      message: `Prepared a search for ${normalized.city}; no durable preferences were saved.`,
    },
  );
  return {
    ready: true,
    city: normalized.city,
    preparedFields: {
      rentalType: normalized.rentalType,
      maxAllIn: normalized.maxAllIn ?? null,
      minBedrooms: normalized.minBedrooms ?? null,
      moveWindow: normalized.moveWindow ?? null,
      sharedContextSummary: normalized.sharedContextSummary ?? null,
      budgetRationale: normalized.budgetRationale ?? null,
    },
    pendingPreferenceCount: state.preferences.filter((item) => item.status === "pending").length,
    pendingAnchorCount: state.anchors.filter((item) => item.status === "pending").length,
  };
}

function proposePreferences(input: PreferenceProposalInput) {
  const countsBefore = { preferences: state.preferences.length, anchors: state.anchors.length };
  const requestedPreferenceLabels = new Set(
    (input.preferences ?? []).map((preference) => preference.label.trim().toLowerCase()),
  );
  const requestedAnchorLabels = new Set(
    (input.anchors ?? []).map((anchor) => anchor.label.trim().toLowerCase()),
  );
  commit(
    (current) => {
      const merged = mergeProposals(current, input);
      const focusedAnchor = [...merged.anchors]
        .reverse()
        .find((anchor) => requestedAnchorLabels.has(anchor.label.toLowerCase()));
      const next = {
        ...current,
        ...merged,
        focusedAnchorId: focusedAnchor?.id ?? current.focusedAnchorId,
      };
      const candidates = recomputeAndSort(next, next.candidates);
      return { ...next, candidates, visibleCandidateIds: candidates.map((candidate) => candidate.id) };
    },
    {
      type: "preferences_proposed",
      source: "agent",
      message: "Agent context was applied to this search and is awaiting review before it can be saved.",
    },
  );
  return {
    proposedPreferences: state.preferences.length - countsBefore.preferences,
    proposedAnchors: state.anchors.length - countsBefore.anchors,
    preferenceIds: state.preferences
      .filter((preference) => requestedPreferenceLabels.has(preference.label.toLowerCase()))
      .map((preference) => preference.id),
    anchorIds: state.anchors
      .filter((anchor) => requestedAnchorLabels.has(anchor.label.toLowerCase()))
      .map((anchor) => anchor.id),
    saveStatus: "pending_human_review" as const,
  };
}

function reviewPreferences(ids: string[], status: "approved" | "rejected") {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) throw new Error("At least one preference or location anchor ID is required.");
  const existingIds = new Set([...state.preferences.map((item) => item.id), ...state.anchors.map((item) => item.id)]);
  const unknown = uniqueIds.filter((id) => !existingIds.has(id));
  if (unknown.length > 0) throw new Error(`Unknown preference or anchor IDs: ${unknown.join(", ")}`);

  commit(
    (current) => {
      const next = {
        ...current,
        preferences: current.preferences.map((preference) =>
          uniqueIds.includes(preference.id) ? { ...preference, status } : preference,
        ),
        anchors: current.anchors.map((anchor) =>
          uniqueIds.includes(anchor.id) ? { ...anchor, status } : anchor,
        ),
      };
      const candidates = recomputeAndSort(next, next.candidates);
      return { ...next, candidates, visibleCandidateIds: candidates.map((candidate) => candidate.id) };
    },
    {
      type: "preferences_reviewed",
      source: "human",
      message: `${uniqueIds.length} context item${uniqueIds.length === 1 ? "" : "s"} ${status}.`,
    },
  );
}

function addLocationAnchor(label: string) {
  const normalizedLabel = label.trim().replace(/\s+/g, " ").slice(0, 160);
  if (!normalizedLabel) throw new Error("Enter a place name or address to add.");

  let selectedAnchorId = "";
  commit(
    (current) => {
      const existing = current.anchors.find(
        (anchor) => anchor.label.toLowerCase() === normalizedLabel.toLowerCase(),
      );
      const proposed = existing ?? proposalRecords({
        anchors: [{
          label: normalizedLabel,
          importance: 3,
          source: "user_stated",
          confidence: 1,
        }],
      }).anchors[0];
      const approvedAnchor: SearchAnchor = {
        ...proposed,
        source: existing?.source ?? "user_stated",
        confidence: existing?.confidence ?? 1,
        status: "approved",
      };
      selectedAnchorId = approvedAnchor.id;
      const anchors = existing
        ? current.anchors.map((anchor) => anchor.id === existing.id ? approvedAnchor : anchor)
        : [...current.anchors, approvedAnchor];
      const next = { ...current, anchors };
      const candidates = recomputeAndSort(next, next.candidates);
      const withCandidates = {
        ...next,
        candidates,
        visibleCandidateIds: candidates.map((candidate) => candidate.id),
      };
      return {
        ...withCandidates,
        focusedAnchorId: selectedAnchorId,
        refinementQuestions: questionsFor(withCandidates),
      };
    },
    {
      type: "location_added",
      source: "human",
      message: `Added ${normalizedLabel} to this workspace's distance context.`,
    },
  );

  const selectedAnchor = state.anchors.find((anchor) => anchor.id === selectedAnchorId);
  if (!selectedAnchor) throw new Error("The location could not be added.");
  return selectedAnchor;
}

function focusLocationAnchor(anchorId: string) {
  const anchor = state.anchors.find((item) => item.id === anchorId && item.status !== "rejected");
  if (!anchor) throw new Error("The requested location anchor does not exist.");
  commit((current) => ({ ...current, focusedAnchorId: anchor.id }));
  return anchor.id;
}

function queueRefinementAnswer(
  questionId: string,
  preference: NonNullable<PreferenceProposalInput["preferences"]>[number],
) {
  const question = state.refinementQuestions.find((item) => item.id === questionId);
  if (!question) throw new Error("That refinement question is not active in this workspace.");
  const merged = mergeProposals(state, { preferences: [{ ...preference, source: "user_stated", confidence: 1 }] });
  const label = preference.label.trim().slice(0, 160);
  commit(
    (current) => ({
      ...current,
      ...merged,
      answeredQuestionIds: [...new Set([...current.answeredQuestionIds, questionId])],
      queuedRefinementLabels: [...new Set([...current.queuedRefinementLabels, label])].slice(-8),
    }),
    {
      type: "refinement_queued",
      source: "human",
      message: "A refinement answer was updated and is ready for the next ranking run.",
    },
  );
  return { questionId, status: "queued_for_rerun" as const };
}

function selectSearchRun(runNumber: number) {
  const run = state.searchRuns.find((item) => item.number === runNumber && item.status === "ready");
  if (!run) throw new Error(`Run ${runNumber} is not ready.`);
  commit((current) => ({
    ...current,
    activeRunNumber: run.number,
    candidates: cloneCandidates(run.candidates),
    visibleCandidateIds: run.candidates.map((candidate) => candidate.id),
    searchStatus: "ready",
    searchNote: `Showing Run ${run.number}.`,
  }));
  return run.number;
}

async function searchCandidates(
  query: SearchQuery = state.query ?? { city: "Salt Lake City", state: "UT" },
  client: SearchClient | null = configuredSearchClient,
): Promise<SearchOutcome> {
  const normalized = normalizeQuery(query);
  const runNumber = Math.max(0, ...state.searchRuns.map((run) => run.number)) + 1;
  const runId = createId("run");
  const runStartedAt = now();
  const runStartedMs = Date.now();
  const triggerLabels = [...state.queuedRefinementLabels];
  commit(
    (current) => {
      const nextRun = {
        id: runId,
        number: runNumber,
        status: "searching" as const,
        startedAt: runStartedAt,
        completedAt: null,
        triggerLabels,
        candidates: [],
      };
      return {
        ...current,
        query: normalized,
        searchStatus: "searching",
        searchNote: `Run ${runNumber} is ranking with the latest approved and updated context.`,
        searchRuns: [...current.searchRuns, nextRun].slice(-5),
      };
    },
    { type: "search_started", source: "agent", message: `Searching apartments in ${normalized.city}.` },
  );

  // Give the browser one brief paint window so the shared human-agent search
  // process is visible without materially delaying the first result set.
  if (runNumber === 1) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 520));
  }

  let candidates: ApartmentCandidate[] = [];
  let sourceMode: SearchOutcome["sourceMode"] = "no_results";
  let note = "No matching results are available in the current source set.";

  if (client) {
    try {
      const live = await client(normalized);
      candidates = cloneCandidates(
        live.slice(0, 100).map((candidate) => ({
          ...candidate,
          distances: [],
          scores: {
            marketValue: {
              score: 50,
              estimatedFairBaseRent: null,
              percentBelowEstimate: null,
              comparableCount: 0,
              explanation: "Pending calculation.",
              caveat: "Market Value is an estimate, not an appraisal.",
            },
            personalFit: {
              score: 50,
              matched: [],
              tensions: [],
              unknowns: [],
              explanation: "Pending calculation.",
            },
            recommended: 50,
          },
          addedBy: "live_search",
        })),
      );
      if (candidates.length > 0) {
        sourceMode = "live_search";
        note = "Live results were returned by the site's same-origin search adapter.";
      }
    } catch {
      note = "Live search was unavailable; no live result is represented as verified.";
    }
  }

  const isSaltLake = /salt lake/i.test(normalized.city);
  if (candidates.length === 0 && isSaltLake) {
    candidates = cloneCandidates(SLC_DEMO_CANDIDATES);
    sourceMode = "curated_demo";
    note = client
      ? `${note} Showing the clearly labeled August 28 Salt Lake City demo snapshot instead.`
      : "Showing a source-linked August 28 Salt Lake City demo snapshot; availability is not live.";
  }

  if (normalized.minBedrooms != null) {
    candidates = candidates.filter(
      (candidate) => candidate.bedrooms != null && candidate.bedrooms >= normalized.minBedrooms!,
    );
  }
  if (normalized.rentalType && normalized.rentalType !== "any") {
    candidates = candidates.filter((candidate) => candidate.rentalType === normalized.rentalType);
  }

  const scored = scoreCandidates(
    candidates,
    [...state.preferences, ...queryPreferences(normalized)],
    state.anchors,
  );
  const sorted = sortCandidates(scored, "recommended", "desc", null).slice(0, 10);

  // Keep a rerun's real state legible even when the deterministic demo scores
  // faster than a human can perceive the Run 2 indicator. Live provider time
  // naturally exceeds this small floor in most cases.
  if (runNumber > 1) {
    const remainingFeedbackMs = 320 - (Date.now() - runStartedMs);
    if (remainingFeedbackMs > 0) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, remainingFeedbackMs));
    }
  }

  // Results are committed before questions on purpose: the renter gets useful output first.
  commit(
    (current) => ({
      ...current,
      query: normalized,
      searchStatus: "ready",
      searchNote: note,
      candidates: sorted,
      visibleCandidateIds: sorted.map((candidate) => candidate.id),
      sort: { by: "recommended", anchorId: null, direction: "desc" },
      comparisonIds: current.comparisonIds.filter((id) => sorted.some((item) => item.id === id)),
      refinementQuestions: [],
      searchRuns: current.searchRuns.map((run) => run.id === runId ? {
        ...run,
        status: "ready" as const,
        completedAt: now(),
        candidates: cloneCandidates(sorted),
      } : run),
      activeRunNumber: runNumber,
      queuedRefinementLabels: [],
    }),
    {
      type: "results_ready",
      source: "system",
      message: `${sorted.length} ranked result${sorted.length === 1 ? "" : "s"} appeared before refinement questions.`,
    },
  );

  await Promise.resolve();
  const refinementQuestions = questionsFor(state);
  commit((current) => ({ ...current, refinementQuestions }));

  return {
    resultCount: sorted.length,
    topCandidateIds: sorted.slice(0, 5).map((candidate) => candidate.id),
    sourceMode,
    note,
    refinementQuestionCount: refinementQuestions.length,
    refinementQuestions: refinementQuestions.map(({ id, question, reason }) => ({
      id,
      question,
      reason,
    })),
    runNumber,
  };
}

function organizeResults(input: {
  by: SortOption;
  anchorId?: string | null;
  direction?: "asc" | "desc";
}) {
  const allowedSorts: SortOption[] = [
    "recommended",
    "market_value",
    "personal_fit",
    "all_in_cost",
    "base_rent",
    "distance",
    "square_feet",
    "freshness",
  ];
  if (!allowedSorts.includes(input.by)) throw new Error("Unsupported result sort.");
  const anchorId = input.anchorId ?? null;
  if (input.by === "distance") {
    if (!anchorId) throw new Error("Sorting by distance requires a location anchor ID.");
    if (!state.anchors.some((anchor) => anchor.id === anchorId && anchor.status !== "rejected")) {
      throw new Error("The requested active location anchor does not exist.");
    }
  }
  const direction = input.direction ?? defaultDirection(input.by);
  commit(
    (current) => {
      const sorted = sortCandidates(current.candidates, input.by, direction, anchorId);
      return {
        ...current,
        sort: { by: input.by, anchorId, direction },
        candidates: sorted,
        visibleCandidateIds: sorted.map((candidate) => candidate.id),
        searchRuns: current.searchRuns.map((run) => run.number === current.activeRunNumber ? {
          ...run,
          candidates: cloneCandidates(sorted),
        } : run),
      };
    },
    {
      type: "results_organized",
      source: "agent",
      message: `Results sorted by ${input.by.replaceAll("_", " ")}.`,
    },
  );
  return { resultCount: state.visibleCandidateIds.length, sort: state.sort };
}

function validatedPublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Listing URL must be a valid absolute URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Listing URL must use HTTP or HTTPS.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Listing URL must point to a public website.");
  }
  return url.toString();
}

function finiteOrNull(value: number | undefined, label: string) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a positive number.`);
  return value;
}

function coordinateOrNull(
  value: number | undefined,
  label: "Latitude" | "Longitude",
) {
  if (value == null) return null;
  const limit = label === "Latitude" ? 90 : 180;
  if (!Number.isFinite(value) || value < -limit || value > limit) {
    throw new Error(`${label} must be between ${-limit} and ${limit}.`);
  }
  return value;
}

function addCandidate(input: AddCandidateInput) {
  const sourceUrl = validatedPublicUrl(input.url);
  if (state.candidates.some((candidate) => candidate.source.url === sourceUrl)) {
    throw new Error("That listing URL is already in the workspace.");
  }
  const baseRent = finiteOrNull(input.baseRent, "Base rent");
  const allInLow = finiteOrNull(input.allInLow, "All-in low estimate");
  const allInHigh = finiteOrNull(input.allInHigh, "All-in high estimate");
  if (allInLow != null && allInHigh != null && allInHigh < allInLow) {
    throw new Error("All-in high estimate cannot be below the low estimate.");
  }
  const imported: ApartmentCandidate = {
    id: createId("imported"),
    name: input.name?.trim().slice(0, 160) || new URL(sourceUrl).hostname,
    address: input.address?.trim().slice(0, 240) || "Address needs enrichment",
    city: input.city?.trim().slice(0, 100) || state.query?.city || "Unknown city",
    state: input.state?.trim().slice(0, 40) || state.query?.state || "",
    neighborhood: input.neighborhood?.trim().slice(0, 120) || "Neighborhood needs enrichment",
    latitude: coordinateOrNull(input.latitude, "Latitude"),
    longitude: coordinateOrNull(input.longitude, "Longitude"),
    baseRent,
    allInEstimate: {
      low: allInLow,
      high: allInHigh,
      note: "Agent- or renter-supplied estimate; verify against the original listing.",
    },
    bedrooms: finiteOrNull(input.bedrooms, "Bedrooms"),
    bathrooms: finiteOrNull(input.bathrooms, "Bathrooms"),
    squareFeet: finiteOrNull(input.squareFeet, "Square feet"),
    availability: "Needs source verification",
    features: [],
    unknowns: ["Availability", "Recurring fees", "Source fields", "Physical layout"],
    source: {
      url: sourceUrl,
      label: "Imported listing URL",
      observedAt: now(),
      evidenceGrade: "unverified",
      note: "The workspace preserved this URL but did not scrape or independently verify it.",
    },
    distances: [],
    scores: {
      marketValue: {
        score: 20,
        estimatedFairBaseRent: null,
        percentBelowEstimate: null,
        comparableCount: 0,
        explanation: "Awaiting enrichment.",
        caveat: "Imported details are unverified.",
      },
      personalFit: {
        score: 50,
        matched: [],
        tensions: [],
        unknowns: ["Awaiting enrichment."],
        explanation: "Awaiting enrichment.",
      },
      recommended: 35,
    },
    rentalType: state.query?.rentalType === "private_room" || state.query?.rentalType === "shared_room"
      ? state.query.rentalType
      : "whole_place",
    addedBy: input.addedBy ?? "agent_import",
  };

  commit(
    (current) => {
      const candidates = recomputeAndSort(current, [...current.candidates, imported]);
      return { ...current, candidates, visibleCandidateIds: candidates.map((item) => item.id) };
    },
    {
      type: "candidate_added",
      source: input.addedBy === "human_import" ? "human" : "agent",
      message: `${imported.name} was added as unverified and needs enrichment.`,
    },
  );
  return imported.id;
}

function compareCandidates(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length < 2 || uniqueIds.length > 4) {
    throw new Error("Choose between 2 and 4 different candidates to compare.");
  }
  const missing = uniqueIds.filter((id) => !state.candidates.some((candidate) => candidate.id === id));
  if (missing.length > 0) throw new Error(`Unknown candidate IDs: ${missing.join(", ")}`);
  commit(
    (current) => ({ ...current, comparisonIds: uniqueIds }),
    {
      type: "comparison_opened",
      source: "agent",
      message: `${uniqueIds.length} candidates are now visible in the comparison workspace.`,
    },
  );
  return state.candidates
    .filter((candidate) => uniqueIds.includes(candidate.id))
    .map((candidate) => ({
      id: candidate.id,
      recommended: candidate.scores.recommended,
      marketValue: candidate.scores.marketValue.score,
      personalFit: candidate.scores.personalFit.score,
      allInHigh: candidate.allInEstimate.high,
      unknownCount: candidate.scores.personalFit.unknowns.length,
    }));
}

function setComparisonSelection(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > 4) throw new Error("Choose no more than 4 candidates to compare.");
  const missing = uniqueIds.filter((id) => !state.candidates.some((candidate) => candidate.id === id));
  if (missing.length > 0) throw new Error(`Unknown candidate IDs: ${missing.join(", ")}`);
  commit((current) => ({ ...current, comparisonIds: uniqueIds }));
  return uniqueIds;
}

function stageDecision(input: {
  candidateId: string;
  rationale: string;
  stagedBy?: "agent" | "human";
}) {
  if (!state.candidates.some((candidate) => candidate.id === input.candidateId)) {
    throw new Error("The candidate to stage is not in the workspace.");
  }
  const rationale = input.rationale.trim();
  if (!rationale) throw new Error("A staged recommendation needs a rationale.");
  if (rationale.length > 800) throw new Error("Rationale must be 800 characters or fewer.");
  const decision: StagedDecision = {
    id: createId("decision"),
    candidateId: input.candidateId,
    rationale,
    stagedAt: now(),
    stagedBy: input.stagedBy ?? "agent",
    status: "staged_for_review",
  };
  commit(
    (current) => ({
      ...current,
      decisionHistory: [...current.decisionHistory, current.stagedDecision].slice(-10),
      stagedDecision: decision,
    }),
    {
      type: "decision_staged",
      source: decision.stagedBy,
      message: "A reversible recommendation is staged for human review; no landlord action occurred.",
    },
  );
  return decision;
}

function undoStageDecision() {
  if (state.decisionHistory.length === 0 && state.stagedDecision == null) return false;
  commit(
    (current) => {
      const history = [...current.decisionHistory];
      const prior = history.pop() ?? null;
      return { ...current, stagedDecision: prior, decisionHistory: history };
    },
    {
      type: "decision_restored",
      source: "human",
      message: "The previous staged-decision state was restored.",
    },
  );
  return true;
}

function resetWorkspace() {
  const reset = initialState();
  commit(reset, {
    type: "workspace_reset",
    source: "human",
    message: "Anonymous workspace reset on this device.",
  });
}

export const workspaceStore = {
  getSnapshot: () => state,
  getServerSnapshot: () => serverSnapshot,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  subscribeToEvents(listener: EventListener) {
    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
  },
};

export const workspaceActions = {
  prepareSearch,
  proposePreferences,
  addLocationAnchor,
  focusLocationAnchor,
  approvePreferences(ids: string[]) {
    reviewPreferences(ids, "approved");
  },
  rejectPreferences(ids: string[]) {
    reviewPreferences(ids, "rejected");
  },
  queueRefinementAnswer,
  searchCandidates,
  selectSearchRun,
  organizeResults,
  addCandidate,
  setComparisonSelection,
  compareCandidates,
  stageDecision,
  undoStageDecision,
  resetWorkspace,
};

export function configureSearchClient(client: SearchClient | null) {
  configuredSearchClient = client;
}

export function createSameOriginSearchClient(path = "/api/search"): SearchClient {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Search adapter path must be same-origin.");
  }
  return async (query) => {
    const cityAndState = query.city.match(/^(.+?),\s*([A-Za-z]{2})$/);
    const city = cityAndState?.[1]?.trim() || query.city;
    const stateCode = (query.state || cityAndState?.[2] || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(stateCode)) {
      throw new Error("Live nationwide search requires a two-letter state abbreviation.");
    }
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        city,
        state: stateCode,
        bedrooms: query.minBedrooms == null ? undefined : String(query.minBedrooms),
        maxRent: query.maxAllIn,
        limit: 200,
      }),
    });
    if (!response.ok) throw new Error(`Same-origin search failed with HTTP ${response.status}.`);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray((data as { candidates?: unknown }).candidates)) {
      throw new Error("Same-origin search returned an invalid candidates payload.");
    }
    const candidates = (data as { candidates: unknown[] }).candidates;
    const valid = candidates.every((candidate) => {
      if (!candidate || typeof candidate !== "object") return false;
      const value = candidate as Partial<ExternalCandidate>;
      let safeSourceUrl = false;
      if (value.source && typeof value.source.url === "string") {
        try {
          validatedPublicUrl(value.source.url);
          safeSourceUrl = true;
        } catch {
          safeSourceUrl = false;
        }
      }
      return (
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.address === "string" &&
        typeof value.city === "string" &&
        typeof value.state === "string" &&
        Array.isArray(value.features) &&
        Array.isArray(value.unknowns) &&
        !!value.source &&
        safeSourceUrl &&
        typeof value.source.observedAt === "string"
      );
    });
    if (!valid) throw new Error("Same-origin search returned malformed candidate records.");
    return candidates as ExternalCandidate[];
  };
}

export function useWorkspace() {
  return useSyncExternalStore(
    workspaceStore.subscribe,
    workspaceStore.getSnapshot,
    workspaceStore.getServerSnapshot,
  );
}
