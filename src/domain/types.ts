export type EvidenceGrade = "A" | "B" | "C" | "unverified";

export type PreferenceStatus = "pending" | "approved" | "rejected";
export type PreferenceSource = "agent_context" | "user_stated" | "site_account";

export type PreferenceKind =
  | "budget"
  | "bedrooms"
  | "minimum_space"
  | "amenity"
  | "furniture"
  | "lifestyle"
  | "lease"
  | "other";

export type SortOption =
  | "recommended"
  | "market_value"
  | "personal_fit"
  | "all_in_cost"
  | "base_rent"
  | "distance"
  | "square_feet"
  | "freshness";

export type SearchStatus = "idle" | "searching" | "ready" | "error";

export type SearchAnchor = {
  id: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  importance: 1 | 2 | 3 | 4 | 5;
  source: PreferenceSource;
  confidence: number;
  status: PreferenceStatus;
  verification: "verified_coordinates" | "agent_supplied_coordinates" | "needs_coordinates";
};

export type Preference = {
  id: string;
  kind: PreferenceKind;
  label: string;
  value: string | number | boolean;
  source: PreferenceSource;
  confidence: number;
  status: PreferenceStatus;
  affectsCurrentSearch: boolean;
  createdAt: string;
};

export type CandidateSource = {
  url: string;
  label: string;
  observedAt: string;
  evidenceGrade: EvidenceGrade;
  note: string;
};

export type CandidateMedia = {
  url: string;
  thumbnailUrl: string;
  alt: string;
  scope: "exact_unit" | "building" | "community" | "illustrative";
  sourceLabel: string;
  sourceUrl: string | null;
  observedAt: string;
  kind?: "photo" | "floor_plan";
};

export type DistanceEstimate = {
  anchorId: string;
  anchorLabel: string;
  straightLineMiles: number | null;
  estimatedDriveMinutes: number | null;
  status: "estimated" | "needs_coordinates";
};

export type MarketValueBreakdown = {
  score: number;
  estimatedFairBaseRent: number | null;
  percentBelowEstimate: number | null;
  comparableCount: number;
  explanation: string;
  caveat: string;
};

export type PersonalFitBreakdown = {
  score: number;
  matched: string[];
  tensions: string[];
  unknowns: string[];
  explanation: string;
};

export type CandidateScores = {
  marketValue: MarketValueBreakdown;
  personalFit: PersonalFitBreakdown;
  recommended: number;
};

export type ApartmentCandidate = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  baseRent: number | null;
  allInEstimate: { low: number | null; high: number | null; note: string };
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  availability: string;
  features: string[];
  unknowns: string[];
  source: CandidateSource;
  media?: CandidateMedia[];
  distances: DistanceEstimate[];
  scores: CandidateScores;
  addedBy: "curated_demo" | "live_search" | "agent_import" | "human_import";
};

export type RefinementQuestion = {
  id: string;
  question: string;
  reason: string;
  blocking: false;
  kind: PreferenceKind;
  origin: "base" | "agent_custom";
};

export type SearchRun = {
  id: string;
  number: number;
  status: "searching" | "ready" | "error";
  startedAt: string;
  completedAt: string | null;
  triggerLabels: string[];
  candidates: ApartmentCandidate[];
};

export type WorkspaceEvent = {
  id: string;
  type:
    | "search_prepared"
    | "preferences_proposed"
    | "preferences_reviewed"
    | "location_added"
    | "search_started"
    | "results_ready"
    | "refinement_queued"
    | "results_organized"
    | "candidate_added"
    | "comparison_opened"
    | "decision_staged"
    | "decision_restored"
    | "workspace_reset";
  source: "agent" | "human" | "system";
  message: string;
  at: string;
};

export type StagedDecision = {
  id: string;
  candidateId: string;
  rationale: string;
  stagedAt: string;
  stagedBy: "agent" | "human";
  status: "staged_for_review";
};

export type SearchQuery = {
  city: string;
  state?: string;
  maxAllIn?: number;
  minBedrooms?: number;
  moveWindow?: string;
  text?: string;
};

export type WorkspaceState = {
  version: 1;
  sessionId: string;
  query: SearchQuery | null;
  searchStatus: SearchStatus;
  searchNote: string;
  candidates: ApartmentCandidate[];
  visibleCandidateIds: string[];
  preferences: Preference[];
  anchors: SearchAnchor[];
  focusedAnchorId: string | null;
  sort: { by: SortOption; anchorId: string | null; direction: "asc" | "desc" };
  refinementQuestions: RefinementQuestion[];
  customRefinementQuestions: RefinementQuestion[];
  answeredQuestionIds: string[];
  queuedRefinementLabels: string[];
  searchRuns: SearchRun[];
  activeRunNumber: number | null;
  comparisonIds: string[];
  stagedDecision: StagedDecision | null;
  decisionHistory: Array<StagedDecision | null>;
  events: WorkspaceEvent[];
  lastUpdatedAt: string;
};

export type PreferenceProposalInput = {
  preferences?: Array<{
    kind: PreferenceKind;
    label: string;
    value: string | number | boolean;
    source?: PreferenceSource;
    confidence?: number;
  }>;
  anchors?: Array<{
    label: string;
    importance?: 1 | 2 | 3 | 4 | 5;
    latitude?: number;
    longitude?: number;
    source?: PreferenceSource;
    confidence?: number;
  }>;
  customQuestions?: Array<{
    question: string;
    reason: string;
    kind?: PreferenceKind;
  }>;
};

export type ExternalCandidate = Omit<ApartmentCandidate, "distances" | "scores" | "addedBy"> & {
  addedBy?: "live_search";
};

export type SearchClient = (query: SearchQuery) => Promise<ExternalCandidate[]>;

export type AddCandidateInput = {
  url: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  baseRent?: number;
  allInLow?: number;
  allInHigh?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  latitude?: number;
  longitude?: number;
  addedBy?: "agent_import" | "human_import";
};
