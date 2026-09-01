import { beforeEach, describe, expect, it } from "vitest";
import { workspaceActions, workspaceStore } from "../domain/store";
import {
  addCandidateTool,
  apartmentWebMCPTools,
  compareCandidatesTool,
  organizeResultsTool,
  prepareSearchTool,
  proposePreferencesTool,
  searchCandidatesTool,
  stageDecisionTool,
} from "./tools";

describe("WebMCP apartment tools", () => {
  beforeEach(() => workspaceActions.resetWorkspace());

  it("keeps the approved stable keys and strict top-level schemas", () => {
    expect(apartmentWebMCPTools.map((tool) => tool.stableKey)).toEqual([
      "apartment.prepare_search",
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
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        untrustedContentHint: true,
      });
    }
  });

  it("executes the same visible search action and returns a compact response", async () => {
    const result = await searchCandidatesTool.execute({ city: "Salt Lake City", state: "UT" });
    expect(result).toMatchObject({ resultCount: 15, sourceMode: "curated_demo" });
    expect(result && typeof result === "object" && "topCandidateIds" in result).toBe(true);
    if (!result || typeof result !== "object" || !("topCandidateIds" in result)) {
      throw new Error("Search tool returned no topCandidateIds array.");
    }
    expect((result.topCandidateIds as unknown[]).length).toBeLessThanOrEqual(5);
    expect("refinementQuestions" in result && Array.isArray(result.refinementQuestions)).toBe(true);
    expect(workspaceStore.getSnapshot().candidates).toHaveLength(15);
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
        anchors: [{ label: "Downtown Salt Lake City", importance: 4 }],
      }),
    ).toMatchObject({ ready: true });
    expect(
      proposePreferencesTool.execute({
        preferences: [{ kind: "minimum_space", label: "At least 700 square feet", value: 700 }],
      }),
    ).toMatchObject({ proposedPreferences: 1, saveStatus: "pending_human_review" });

    await searchCandidatesTool.execute({ city: "Salt Lake City", state: "UT" });
    expect(organizeResultsTool.execute({ sortBy: "market_value" })).toMatchObject({
      resultCount: 15,
    });
    expect(
      addCandidateTool.execute({
        url: "https://example.com/webmcp-invocation-listing",
        name: "Invocation test listing",
      }),
    ).toMatchObject({ evidenceStatus: "unverified", enrichmentRequired: true });

    const ids = workspaceStore.getSnapshot().candidates.slice(0, 2).map((candidate) => candidate.id);
    expect(compareCandidatesTool.execute({ candidateIds: ids })).toMatchObject({ visible: true });
    expect(
      stageDecisionTool.execute({ candidateId: ids[0], rationale: "Review this current leader." }),
    ).toMatchObject({ reversible: true, externalActionTaken: false });
    expect(workspaceStore.getSnapshot().events.length).toBeGreaterThanOrEqual(7);
  });
});
