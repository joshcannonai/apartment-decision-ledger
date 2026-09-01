import { defineTool } from "@nekuda/webmcp-sdk";
import { workspaceActions, workspaceStore } from "../domain/store";
import type {
  AddCandidateInput,
  PreferenceKind,
  PreferenceProposalInput,
  PreferenceSource,
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
  maxAllIn?: number;
  minBedrooms?: number;
  moveWindow?: string;
  request?: string;
  preferences?: ToolPreference[];
  anchors?: ToolAnchor[];
};

type ProposePreferencesInput = {
  preferences?: ToolPreference[];
  anchors?: ToolAnchor[];
};

type SearchCandidatesInput = {
  city: string;
  state?: string;
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
    maxAllIn: input.maxAllIn,
    minBedrooms: input.minBedrooms,
    moveWindow: input.moveWindow,
    text: input.request,
  };
}

function toProposals(input: ProposePreferencesInput | PrepareSearchInput): PreferenceProposalInput {
  return { preferences: input.preferences, anchors: input.anchors };
}

export const prepareSearchTool = defineTool<PrepareSearchInput>({
  stableKey: "apartment.prepare_search",
  name: "prepare_search",
  title: "Prepare apartment search",
  description:
    "Prepare an apartment search from the renter's request and only the context they or their agent explicitly share. Use before searching when context is available. It visibly labels agent-proposed preferences and location anchors as pending, applies them only to the current search, saves nothing durably without human approval, and returns readiness counts.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", minLength: 1, maxLength: 100 },
      state: { type: "string", maxLength: 40 },
      maxAllIn: { type: "number", minimum: 300 },
      minBedrooms: { type: "integer", minimum: 0, maximum: 10 },
      moveWindow: { type: "string", maxLength: 160 },
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
    "Show renter preferences or important location anchors that the agent has relevant reason to propose. Use to improve the current ranking after results appear. The proposals visibly include source and confidence, immediately affect only this search, and remain pending until the human approves or rejects them.",
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
    },
    additionalProperties: false,
  },
  execute(input) {
    if ((input.preferences?.length ?? 0) === 0 && (input.anchors?.length ?? 0) === 0) {
      throw new Error("Provide at least one preference or location anchor to propose.");
    }
    return workspaceActions.proposePreferences(toProposals(input));
  },
});

export const searchCandidatesTool = defineTool<SearchCandidatesInput>({
  stableKey: "apartment.search_candidates",
  name: "search_candidates",
  title: "Search apartment candidates",
  description:
    "Run the site's apartment search and visibly rank up to 15 candidates. Use as soon as a city is known; do not wait for every preference. Results appear before optional refinement questions. It returns compact result IDs, source-mode metadata, and the few follow-up questions the agent should ask next; listing claims remain untrusted until their linked sources are verified.",
  version: "1.0.0",
  source: "merchant_authored",
  intent: "act",
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", minLength: 1, maxLength: 100 },
      state: { type: "string", maxLength: 40 },
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
  proposePreferencesTool,
  searchCandidatesTool,
  organizeResultsTool,
  addCandidateTool,
  compareCandidatesTool,
  stageDecisionTool,
] as const;
