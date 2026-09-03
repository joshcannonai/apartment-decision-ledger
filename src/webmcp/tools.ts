import { defineTool } from "@nekuda/webmcp-sdk";
import { workspaceActions, workspaceStore } from "../domain/store";
import type {
  AddCandidateInput,
  PreferenceKind,
  PreferenceProposalInput,
  PreferenceSource,
  RentalType,
  SearchQuery,
  SortOption,
} from "../domain/types";

type ToolPreference = {
  kind: PreferenceKind;
  label: string;
  value: string | number | boolean;
  source?: PreferenceSource;
  confidence?: number;
};

type ToolAnchor = {
  label: string;
  importance?: 1 | 2 | 3 | 4 | 5;
  latitude?: number;
  longitude?: number;
  source?: PreferenceSource;
  confidence?: number;
};

type PrepareSearchInput = {
  city: string;
  state?: string;
  rentalType?: RentalType;
  maxAllIn?: number;
  minBedrooms?: number;
  moveWindow?: string;
  sharedContextSummary?: string;
  budgetRationale?: string;
  request?: string;
  preferences?: ToolPreference[];
  anchors?: ToolAnchor[];
  customQuestions?: ToolQuestion[];
};

type ProposePreferencesInput = {
  preferences?: ToolPreference[];
  anchors?: ToolAnchor[];
  customQuestions?: ToolQuestion[];
};

type ToolQuestion = {
  question: string;
  reason: string;
  kind?: PreferenceKind;
};

type SearchCandidatesInput = {
  city: string;
  state?: string;
  rentalType?: RentalType;
  maxAllIn?: number;
  minBedrooms?: number;
  moveWindow?: string;
  request?: string;
};

type OrganizeResultsInput = {
  sortBy: SortOption;
  anchorId?: string;
  direction?: "asc" | "desc";
};

type AddCandidateToolInput = Omit<AddCandidateInput, "addedBy">;
type CompareCandidatesInput = { candidateIds: string[] };
type StageDecisionInput = { candidateId: string; rationale: string };
type ReviewWorkspaceInput = Record<string, never>;

const preferenceProperties = {
  kind: {
    type: "string",
    enum: [
      "budget",
      "bedrooms",
      "minimum_space",
      "amenity",
      "furniture",
      "lifestyle",
      "lease",
      "other",
    ],
  },
  label: { type: "string", minLength: 1, maxLength: 160 },
  value: { type: ["string", "number", "boolean"] },
  source: { type: "string", enum: ["agent_context", "user_stated", "site_account"] },
  confidence: { type: "number", minimum: 0, maximum: 1 },
};

const anchorProperties = {
  label: { type: "string", minLength: 1, maxLength: 160 },
  importance: { type: "integer", minimum: 1, maximum: 5 },
  latitude: { type: "number", minimum: -90, maximum: 90 },
  longitude: { type: "number", minimum: -180, maximum: 180 },
  source: { type: "string", enum: ["agent_context", "user_stated", "site_account"] },
  confidence: { type: "number", minimum: 0, maximum: 1 },
};

function toQuery(input: SearchCandidatesInput | PrepareSearchInput): SearchQuery {
  return {
    city: input.city,
    state: input.state,
    rentalType: input.rentalType,
    maxAllIn: input.maxAllIn,
    minBedrooms: input.minBedrooms,
    moveWindow: input.moveWindow,
    sharedContextSummary: "sharedContextSummary" in input ? input.sharedContextSummary : undefined,
    budgetRationale: "budgetRationale" in input ? input.budgetRationale : undefined,
    text: input.request,
  };
}

function toProposals(input: ProposePreferencesInput | PrepareSearchInput): PreferenceProposalInput {
  return {
    preferences: input.preferences,
    anchors: input.anchors,
    customQuestions: input.customQuestions,
  };
}

const customQuestionSchema = {
  type: "array",
  maxItems: 8,
  items: {
    type: "object",
    properties: {
      question: { type: "string", minLength: 1, maxLength: 180 },
      reason: { type: "string", minLength: 1, maxLength: 220 },
      kind: { type: "string", enum: Object.values(preferenceProperties.kind.enum) },
    },
    required: ["question", "reason"],
    additionalProperties: false,
  },
};

export const prepareSearchTool = defineTool<PrepareSearchInput>({
  stableKey: "apartment.prepare_search",
  name: "prepare_search",
  title: "Prepare apartment search",
  description:
    "Prepare an apartment search from the renter's request and only apartment-relevant context the renter or their agent explicitly shares. Use relevant information you already know about the renter to prefill the visible location, rental type, budget, bedroom, move-timing, and shared-context fields and avoid redundant questions. Clearly distinguish remembered facts from inferred suggestions; if proposing a budget from sensitive context, include a visible rationale and treat it as editable guidance. Do not invent missing information. Nothing is saved durably without human approval. Returns the visible prepared fields and pending context counts.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", minLength: 1, maxLength: 100 },
      state: { type: "string", maxLength: 40 },
      rentalType: { type: "string", enum: ["any", "whole_place", "private_room", "shared_room"] },
      maxAllIn: { type: "number", minimum: 300 },
      minBedrooms: { type: "integer", minimum: 0, maximum: 10 },
      moveWindow: { type: "string", maxLength: 160 },
      sharedContextSummary: { type: "string", maxLength: 1200 },
      budgetRationale: { type: "string", maxLength: 280 },
      request: { type: "string", maxLength: 500 },
      preferences: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          properties: preferenceProperties,
          required: ["kind", "label", "value"],
          additionalProperties: false,
        },
      },
      anchors: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: anchorProperties,
          required: ["label"],
          additionalProperties: false,
        },
      },
      customQuestions: customQuestionSchema,
    },
    required: ["city"],
    additionalProperties: false,
  },
  execute(input) {
    return workspaceActions.prepareSearch(toQuery(input), toProposals(input));
  },
});

export const proposePreferencesTool = defineTool<ProposePreferencesInput>({
  stableKey: "apartment.propose_preferences",
  name: "propose_preferences",
  title: "Propose renter context",
  description:
    "Show renter preferences, important location anchors, or relevant custom follow-up questions the agent has reason to propose. Use to improve the current ranking after results appear. Context proposals visibly include source and confidence, affect only a later explicit rerun, and remain pending until the human approves or rejects them for durable saving.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      preferences: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          properties: preferenceProperties,
          required: ["kind", "label", "value"],
          additionalProperties: false,
        },
      },
      anchors: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: anchorProperties,
          required: ["label"],
          additionalProperties: false,
        },
      },
      customQuestions: customQuestionSchema,
    },
    additionalProperties: false,
  },
  execute(input) {
    if (
      (input.preferences?.length ?? 0) === 0 &&
      (input.anchors?.length ?? 0) === 0 &&
      (input.customQuestions?.length ?? 0) === 0
    ) {
      throw new Error("Provide at least one preference, location anchor, or custom question to propose.");
    }
    return workspaceActions.proposePreferences(toProposals(input));
  },
});

export const reviewWorkspaceTool = defineTool<ReviewWorkspaceInput>({
  stableKey: "apartment.review_workspace",
  name: "review_workspace",
  title: "Review apartment workspace",
  description:
    "Read a compact summary of the current apartment workspace. Use when opening or revisiting the page, or before reranking, comparing, or staging a recommendation. It returns the active search and run, up to five leading candidate IDs with decision signals, pending context, unanswered refinement questions, comparison IDs, and any staged recommendation without changing the page state.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute() {
    const current = workspaceStore.getSnapshot();
    if (!current.query && current.candidates.length === 0) {
      return {
        status: "empty" as const,
        note: "No apartment search exists yet. Prepare or run a search to begin.",
      };
    }

    const candidatesById = new Map(current.candidates.map((candidate) => [candidate.id, candidate]));
    return {
      status: current.searchStatus,
      query: current.query,
      activeRunNumber: current.activeRunNumber,
      sort: current.sort,
      focusedAnchorId: current.focusedAnchorId,
      leadingCandidates: current.visibleCandidateIds.slice(0, 5).flatMap((candidateId, index) => {
        const candidate = candidatesById.get(candidateId);
        if (!candidate) return [];
        return [{
          rank: index + 1,
          id: candidate.id,
          name: candidate.name,
          estimatedAllIn: candidate.allInEstimate,
          marketValueScore: candidate.scores.marketValue.score,
          personalFitScore: candidate.scores.personalFit.score,
          evidenceGrade: candidate.source.evidenceGrade,
          keyUnknowns: candidate.unknowns.slice(0, 3),
        }];
      }),
      pendingContext: {
        preferences: current.preferences
          .filter((preference) => preference.status === "pending")
          .map(({ id, label, source, confidence }) => ({ id, label, source, confidence })),
        anchors: current.anchors
          .filter((anchor) => anchor.status === "pending")
          .map(({ id, label, source, confidence, verification }) => ({ id, label, source, confidence, verification })),
      },
      refinementQuestions: current.refinementQuestions.map(({ id, question, reason }) => ({ id, question, reason })),
      comparisonIds: current.comparisonIds,
      stagedDecision: current.stagedDecision,
      note: "This is a compact workspace summary; linked listing claims still require source verification.",
    };
  },
});

export const searchCandidatesTool = defineTool<SearchCandidatesInput>({
  stableKey: "apartment.search_candidates",
  name: "search_candidates",
  title: "Search apartment candidates",
  description:
    "Run the site's apartment search and visibly rank up to 10 candidates. Use as soon as a city is known; do not wait for every preference. Results appear before optional refinement questions. A later call creates a preserved numbered run so the renter can compare ranking changes. It returns compact result IDs, source-mode metadata, and the few follow-up questions the agent should ask next; listing claims remain untrusted until their linked sources are verified.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", minLength: 1, maxLength: 100 },
      state: { type: "string", maxLength: 40 },
      rentalType: { type: "string", enum: ["any", "whole_place", "private_room", "shared_room"] },
      maxAllIn: { type: "number", minimum: 300 },
      minBedrooms: { type: "integer", minimum: 0, maximum: 10 },
      moveWindow: { type: "string", maxLength: 160 },
      request: { type: "string", maxLength: 500 },
    },
    required: ["city"],
    additionalProperties: false,
  },
  async execute(input) {
    return await workspaceActions.searchCandidates(toQuery(input));
  },
});

export const organizeResultsTool = defineTool<OrganizeResultsInput>({
  stableKey: "apartment.organize_results",
  name: "organize_results",
  title: "Organize apartment results",
  description:
    "Sort the apartment cards already in the shared workspace by recommendation, Market Value, Personal Fit, estimated all-in cost, base rent, distance to an active anchor, square feet, or evidence freshness. Use after search instead of rerunning discovery. It visibly reorders the cards and returns the applied sort.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      sortBy: {
        type: "string",
        enum: [
          "recommended",
          "market_value",
          "personal_fit",
          "all_in_cost",
          "base_rent",
          "distance",
          "square_feet",
          "freshness",
        ],
      },
      anchorId: { type: "string" },
      direction: { type: "string", enum: ["asc", "desc"] },
    },
    required: ["sortBy"],
    additionalProperties: false,
  },
  execute(input) {
    return workspaceActions.organizeResults({
      by: input.sortBy,
      anchorId: input.anchorId,
      direction: input.direction,
    });
  },
});

export const addCandidateTool = defineTool<AddCandidateToolInput>({
  stableKey: "apartment.add_candidate",
  name: "add_candidate",
  title: "Add apartment candidate",
  description:
    "Add a public apartment-listing URL found elsewhere to the visible workspace. Use when discovery finds a candidate outside the current result set. It validates the URL, preserves provenance, labels supplied facts unverified, performs no scraping or third-party call, and returns the new candidate ID for later enrichment.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", minLength: 8, maxLength: 2048 },
      name: { type: "string", maxLength: 160 },
      address: { type: "string", maxLength: 240 },
      city: { type: "string", maxLength: 100 },
      state: { type: "string", maxLength: 40 },
      neighborhood: { type: "string", maxLength: 120 },
      baseRent: { type: "number", minimum: 0 },
      allInLow: { type: "number", minimum: 0 },
      allInHigh: { type: "number", minimum: 0 },
      bedrooms: { type: "number", minimum: 0, maximum: 20 },
      bathrooms: { type: "number", minimum: 0, maximum: 20 },
      squareFeet: { type: "number", minimum: 0, maximum: 100000 },
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
    },
    required: ["url"],
    additionalProperties: false,
  },
  execute(input) {
    const id = workspaceActions.addCandidate({ ...input, addedBy: "agent_import" });
    return { candidateId: id, evidenceStatus: "unverified", enrichmentRequired: true };
  },
});

export const compareCandidatesTool = defineTool<CompareCandidatesInput>({
  stableKey: "apartment.compare_candidates",
  name: "compare_candidates",
  title: "Compare apartment candidates",
  description:
    "Open a visible side-by-side comparison for 2 to 4 existing apartment candidates. Use after ranking to inspect cost, Market Value, Personal Fit, location evidence and unknowns. It changes only the comparison view and returns compact score summaries; it does not contact a landlord or make a decision.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      candidateIds: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        uniqueItems: true,
        items: { type: "string" },
      },
    },
    required: ["candidateIds"],
    additionalProperties: false,
  },
  execute(input) {
    const comparison = workspaceActions.compareCandidates(input.candidateIds);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("apartment-ledger:open-comparison"));
    }
    return {
      comparison,
      visible: true,
    };
  },
});

export const stageDecisionTool = defineTool<StageDecisionInput>({
  stableKey: "apartment.stage_decision",
  name: "stage_decision",
  title: "Stage apartment recommendation",
  description:
    "Stage one existing apartment as a reversible recommendation for the renter to review. Use only after comparing evidence and explain why. It visibly records the rationale, can be undone in the site, and never applies, books, pays, signs, messages a landlord, or otherwise commits the renter.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      candidateId: { type: "string", minLength: 1 },
      rationale: { type: "string", minLength: 1, maxLength: 800 },
    },
    required: ["candidateId", "rationale"],
    additionalProperties: false,
  },
  execute(input) {
    const decision = workspaceActions.stageDecision({ ...input, stagedBy: "agent" });
    const candidate = workspaceStore
      .getSnapshot()
      .candidates.find((item) => item.id === decision.candidateId);
    return {
      decisionId: decision.id,
      candidateId: decision.candidateId,
      candidateName: candidate?.name ?? "Unknown candidate",
      status: decision.status,
      reversible: true,
      externalActionTaken: false,
    };
  },
});

export const apartmentWebMCPTools = [
  prepareSearchTool,
  reviewWorkspaceTool,
  proposePreferencesTool,
  searchCandidatesTool,
  organizeResultsTool,
  addCandidateTool,
  compareCandidatesTool,
  stageDecisionTool,
] as const;
