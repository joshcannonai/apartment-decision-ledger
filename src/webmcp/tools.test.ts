import { beforeEach, describe, expect, it } from "vitest";
import { workspaceActions, workspaceStore } from "../domain/store";
import {
  addCandidateTool,
  apartmentWebMCPTools,
  compareCandidatesTool,
  organizeResultsTool,
  prepareSearchTool,
  proposePreferencesTool,
  reviewWorkspaceTool,
  searchCandidatesTool,
  stageDecisionTool,
} from "./tools";

describe("WebMCP apartment tools", () => {
  beforeEach(() => workspaceActions.resetWorkspace());

  it("keeps the approved stable keys and strict top-level schemas", () => {
    expect(apartmentWebMCPTools.map((tool) => tool.stableKey)).toEqual([
      "apartment.prepare_search",
      "apartment.review_workspace",
      "apartment.propose_preferences",
      "apartment.search_candidates",
      "apartment.organize_results",
      "apartment.add_candidate",
      "apartment.compare_candidates",
      "apartment.stage_decision",
    ]);
    for (const tool of apartmentWebMCPTools) {
      expect(tool.name).toMatch(/^[a-z]+_[a-z_]+$/);
      expect(tool.inputSchema?.additionalProperties).toBe(false);
      expect(tool.annotations?.untrustedContentHint).toBe(true);
    }
    expect(reviewWorkspaceTool.annotations?.readOnlyHint).toBe(true);
    expect(apartmentWebMCPTools.filter((tool) => tool !== reviewWorkspaceTool)
      .every((tool) => tool.annotations?.readOnlyHint === false)).toBe(true);
  });

  it("executes the same visible search action and returns a compact response", async () => {
    const result = await searchCandidatesTool.execute({ city: "Salt Lake City", state: "UT" });
    expect(result).toMatchObject({ resultCount: 10, sourceMode: "curated_demo" });
    expect(result && typeof result === "object" && "topCandidateIds" in result).toBe(true);
    if (!result || typeof result !== "object" || !("topCandidateIds" in result)) {
      throw new Error("Search tool returned no topCandidateIds array.");
    }
    expect((result.topCandidateIds as unknown[]).length).toBeLessThanOrEqual(5);
    expect("refinementQuestions" in result && Array.isArray(result.refinementQuestions)).toBe(true);
    expect(workspaceStore.getSnapshot().candidates).toHaveLength(10);
  });

  it("reviews a persisted workspace without mutating it", async () => {
    expect(reviewWorkspaceTool.execute({})).toMatchObject({ status: "empty" });
    await workspaceActions.searchCandidates({ city: "Salt Lake City", state: "UT" });
    const before = JSON.stringify(workspaceStore.getSnapshot());
    const summary = reviewWorkspaceTool.execute({});

    expect(summary).toMatchObject({ status: "ready", activeRunNumber: 1 });
    if (!summary || typeof summary !== "object" || !("leadingCandidates" in summary)) {
      throw new Error("Review tool returned no leadingCandidates array.");
    }
    expect(summary.leadingCandidates).toHaveLength(5);
    expect(JSON.stringify(workspaceStore.getSnapshot())).toBe(before);
  });

  it("stages only a reversible recommendation with no external action", async () => {
    await workspaceActions.searchCandidates({ city: "Salt Lake City" });
    const candidateId = workspaceStore.getSnapshot().candidates[0].id;
    const result = stageDecisionTool.execute({
      candidateId,
      rationale: "Best supported current option.",
    });
    expect(result).toMatchObject({
      candidateId,
      status: "staged_for_review",
      reversible: true,
      externalActionTaken: false,
    });
  });

  it("executes every approved tool through the shared visible workspace", async () => {
    expect(
      prepareSearchTool.execute({
        city: "Salt Lake City",
        state: "UT",
        rentalType: "whole_place",
        sharedContextSummary: "Lives alone and owns a 72-inch desk.",
        budgetRationale: "Editable suggestion based on user context.",
        anchors: [{ label: "Downtown Salt Lake City", importance: 4 }],
        customQuestions: [{
          question: "Would a walk-up work with your large desk?",
          reason: "The agent knows the renter owns unusually large furniture.",
          kind: "furniture",
        }],
      }),
    ).toMatchObject({
      ready: true,
      preparedFields: {
        rentalType: "whole_place",
        sharedContextSummary: "Lives alone and owns a 72-inch desk.",
      },
    });
    expect(
      proposePreferencesTool.execute({
        preferences: [{ kind: "minimum_space", label: "At least 700 square feet", value: 700 }],
        anchors: [{ label: "University of Utah", importance: 4 }],
      }),
    ).toMatchObject({
      proposedPreferences: 1,
      proposedAnchors: 1,
      anchorIds: [expect.stringMatching(/^anchor-/)],
      saveStatus: "pending_human_review",
    });

    await searchCandidatesTool.execute({ city: "Salt Lake City", state: "UT" });
    expect(reviewWorkspaceTool.execute({})).toMatchObject({
      status: "ready",
      activeRunNumber: 1,
    });
    expect(workspaceStore.getSnapshot().refinementQuestions.some((question) => question.origin === "agent_custom")).toBe(true);
    expect(organizeResultsTool.execute({ sortBy: "market_value" })).toMatchObject({
      resultCount: 10,
    });
    expect(
      addCandidateTool.execute({
        url: "https://example.com/webmcp-invocation-listing",
        name: "Invocation test listing",
      }),
    ).toMatchObject({ evidenceStatus: "unverified", enrichmentRequired: true });

    const ids = workspaceStore.getSnapshot().candidates.slice(0, 2).map((candidate) => candidate.id);
    expect(compareCandidatesTool.execute({ candidateIds: ids })).toMatchObject({ visible: false });
    expect(
      stageDecisionTool.execute({ candidateId: ids[0], rationale: "Review this current leader." }),
    ).toMatchObject({ reversible: true, externalActionTaken: false });
    expect(workspaceStore.getSnapshot().events.length).toBeGreaterThanOrEqual(7);
  });
});
