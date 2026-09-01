import { beforeEach, describe, expect, it } from "vitest";
import { SLC_DEMO_CANDIDATES } from "../data/slcCandidates";
import { scoreCandidates } from "./scoring";
import { workspaceActions, workspaceStore } from "./store";

describe("apartment workspace", () => {
  beforeEach(() => {
    workspaceActions.resetWorkspace();
  });

  it("publishes 15 source-linked demo results before refinement questions", async () => {
    const snapshots: Array<{ status: string; resultCount: number; questionCount: number }> = [];
    const unsubscribe = workspaceStore.subscribe(() => {
      const snapshot = workspaceStore.getSnapshot();
      snapshots.push({
        status: snapshot.searchStatus,
        resultCount: snapshot.candidates.length,
        questionCount: snapshot.refinementQuestions.length,
      });
    });

    const result = await workspaceActions.searchCandidates({ city: "Salt Lake City", state: "UT" });
    unsubscribe();

    expect(result.sourceMode).toBe("curated_demo");
    expect(result.resultCount).toBe(15);
    expect(workspaceStore.getSnapshot().candidates).toHaveLength(15);
    expect(
      workspaceStore.getSnapshot().candidates.every((candidate) => {
        const url = new URL(candidate.source.url);
        return url.protocol === "https:" && candidate.source.observedAt.length > 0;
      }),
    ).toBe(true);

    const resultsFirstIndex = snapshots.findIndex(
      (snapshot) => snapshot.status === "ready" && snapshot.resultCount === 15 && snapshot.questionCount === 0,
    );
    const questionsIndex = snapshots.findIndex(
      (snapshot) => snapshot.status === "ready" && snapshot.questionCount > 0,
    );
    expect(resultsFirstIndex).toBeGreaterThanOrEqual(0);
    expect(questionsIndex).toBeGreaterThan(resultsFirstIndex);
  });

  it("keeps agent context pending while applying it to the current ranking", async () => {
    workspaceActions.prepareSearch(
      { city: "Salt Lake City", maxAllIn: 1700 },
      {
        preferences: [
          {
            kind: "furniture",
            label: "Space for a 72-inch desk",
            value: "72-inch desk",
            source: "agent_context",
            confidence: 0.9,
          },
        ],
        anchors: [
          {
            label: "Trader Joe's Salt Lake City",
            importance: 5,
            source: "agent_context",
            confidence: 0.8,
          },
        ],
      },
    );
    await workspaceActions.searchCandidates({ city: "Salt Lake City", maxAllIn: 1700 });
    const pending = workspaceStore.getSnapshot();
    expect(pending.preferences[0].status).toBe("pending");
    expect(pending.preferences[0].affectsCurrentSearch).toBe(true);
    expect(pending.anchors[0]).toMatchObject({
      status: "pending",
      verification: "verified_coordinates",
    });
    expect(pending.candidates.some((candidate) => candidate.distances.length === 1)).toBe(true);
    expect(pending.candidates.some((candidate) => candidate.scores.personalFit.matched.length > 0)).toBe(
      true,
    );

    workspaceActions.approvePreferences([pending.preferences[0].id, pending.anchors[0].id]);
    const approved = workspaceStore.getSnapshot();
    expect(approved.preferences[0].status).toBe("approved");
    expect(approved.anchors[0].status).toBe("approved");
    expect(JSON.parse(localStorage.getItem("apartment-decision-ledger.workspace.v1") ?? "{}").version).toBe(
      1,
    );
  });

  it("calculates transparent market and personal scores", () => {
    const scored = scoreCandidates(SLC_DEMO_CANDIDATES, [], []);
    expect(scored).toHaveLength(15);
    for (const candidate of scored) {
      expect(candidate.scores.marketValue.score).toBeGreaterThanOrEqual(0);
      expect(candidate.scores.marketValue.score).toBeLessThanOrEqual(100);
      expect(candidate.scores.marketValue.comparableCount).toBeGreaterThan(0);
      expect(candidate.scores.marketValue.explanation).toContain("comparables");
      expect(candidate.scores.marketValue.caveat).toContain("displayed listings");
      expect(candidate.scores.personalFit.explanation).toContain("Neutral");
    }
  });

  it("sorts by an approved anchor, compares 2-4, and reverses staged decisions", async () => {
    workspaceActions.proposePreferences({
      anchors: [{ label: "Downtown Salt Lake City", importance: 5 }],
    });
    const anchorId = workspaceStore.getSnapshot().anchors[0].id;
    workspaceActions.approvePreferences([anchorId]);
    await workspaceActions.searchCandidates({ city: "Salt Lake City" });
    const organized = workspaceActions.organizeResults({ by: "distance", anchorId });
    expect(organized.sort).toMatchObject({ by: "distance", anchorId, direction: "asc" });

    const ids = workspaceStore.getSnapshot().candidates.slice(0, 3).map((candidate) => candidate.id);
    expect(workspaceActions.compareCandidates(ids)).toHaveLength(3);
    const decision = workspaceActions.stageDecision({
      candidateId: ids[0],
      rationale: "Best current balance of cost, evidence and anchor distance.",
      stagedBy: "agent",
    });
    expect(decision.status).toBe("staged_for_review");
    expect(workspaceStore.getSnapshot().stagedDecision?.id).toBe(decision.id);
    expect(workspaceActions.undoStageDecision()).toBe(true);
    expect(workspaceStore.getSnapshot().stagedDecision).toBeNull();
  });

  it("adds only public listing URLs as explicitly unverified candidates", async () => {
    await workspaceActions.searchCandidates({ city: "Salt Lake City" });
    expect(() => workspaceActions.addCandidate({ url: "http://127.0.0.1/private" })).toThrow(
      "public website",
    );
    const id = workspaceActions.addCandidate({
      url: "https://example.com/listing/123",
      name: "Imported example",
      baseRent: 1400,
      allInLow: 1500,
      allInHigh: 1600,
    });
    const imported = workspaceStore.getSnapshot().candidates.find((candidate) => candidate.id === id);
    expect(imported).toMatchObject({
      addedBy: "agent_import",
      source: { evidenceGrade: "unverified" },
    });
    expect(imported?.unknowns.length).toBeGreaterThan(0);
  });
});
