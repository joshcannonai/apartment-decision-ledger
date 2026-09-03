import { beforeEach, describe, expect, it } from "vitest";
import { SLC_DEMO_CANDIDATES } from "../data/slcCandidates";
import { scoreCandidates } from "./scoring";
import { refreshCuratedDemoMedia, workspaceActions, workspaceStore } from "./store";

describe("apartment workspace", () => {
  beforeEach(() => {
    workspaceActions.resetWorkspace();
  });

  it("publishes 10 source-linked demo results before refinement questions", async () => {
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
    expect(result.resultCount).toBe(10);
    expect(workspaceStore.getSnapshot().candidates).toHaveLength(10);
    expect(
      workspaceStore.getSnapshot().candidates.every((candidate) => {
        const url = new URL(candidate.source.url);
        return url.protocol === "https:" && candidate.source.observedAt.length > 0;
      }),
    ).toBe(true);

    const resultsFirstIndex = snapshots.findIndex(
      (snapshot) => snapshot.status === "ready" && snapshot.resultCount === 10 && snapshot.questionCount === 0,
    );
    const questionsIndex = snapshots.findIndex(
      (snapshot) => snapshot.status === "ready" && snapshot.questionCount > 0,
    );
    expect(resultsFirstIndex).toBeGreaterThanOrEqual(0);
    expect(questionsIndex).toBeGreaterThan(resultsFirstIndex);
  });

  it("refreshes stale media in persisted demo runs without changing user decision state", () => {
    const current = SLC_DEMO_CANDIDATES[0];
    const stale = {
      ...current,
      media: [{
        ...current.media![0],
        url: "/demo-media/old-shared-fallback.webp",
        thumbnailUrl: "/demo-media/old-shared-fallback.webp",
      }],
      scores: { ...current.scores, recommended: 93 },
    };

    const [refreshed] = refreshCuratedDemoMedia([stale]);

    expect(refreshed.media?.[0].url).toBe(current.media?.[0].url);
    expect(refreshed.scores.recommended).toBe(93);
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

  it("keeps Run 1 selectable while a queued answer creates Run 2", async () => {
    await workspaceActions.searchCandidates({ city: "Salt Lake City" });
    const first = workspaceStore.getSnapshot();
    const question = first.refinementQuestions.find((item) => item.id === "refine-space");
    expect(question).toBeDefined();
    expect(first.searchRuns).toHaveLength(1);

    const firstScores = new Map(first.searchRuns[0].candidates.map((candidate) => [candidate.id, candidate.scores.personalFit.score]));
    workspaceActions.queueRefinementAnswer(question!.id, {
      kind: "furniture",
      label: `${question!.question} Needs space for a 72-inch desk`,
      value: "72-inch desk",
    });
    const queued = workspaceStore.getSnapshot();
    expect(queued.activeRunNumber).toBe(1);
    expect(queued.queuedRefinementLabels).toHaveLength(1);
    expect(queued.candidates.map((candidate) => candidate.id)).toEqual(first.candidates.map((candidate) => candidate.id));

    const snapshots: string[] = [];
    const unsubscribe = workspaceStore.subscribe(() => snapshots.push(workspaceStore.getSnapshot().searchStatus));
    await workspaceActions.searchCandidates({ city: "Salt Lake City" });
    unsubscribe();

    const second = workspaceStore.getSnapshot();
    expect(snapshots).toContain("searching");
    expect(second.searchRuns.map((run) => run.status)).toEqual(["ready", "ready"]);
    expect(second.activeRunNumber).toBe(2);
    expect(second.searchRuns[1].triggerLabels[0]).toContain("72-inch desk");
    expect(second.searchRuns[1].candidates.some((candidate) => candidate.scores.personalFit.score !== firstScores.get(candidate.id))).toBe(true);

    workspaceActions.selectSearchRun(1);
    expect(workspaceStore.getSnapshot().activeRunNumber).toBe(1);
    expect(workspaceStore.getSnapshot().candidates[0].scores.personalFit.score).toBe(
      workspaceStore.getSnapshot().searchRuns[0].candidates[0].scores.personalFit.score,
    );
  });

  it("mixes agent custom questions with unanswered deterministic questions", async () => {
    workspaceActions.prepareSearch(
      { city: "Salt Lake City" },
      {
        customQuestions: [{
          question: "Would carrying a large desk up stairs rule out a walk-up?",
          reason: "Your agent identified unusually large furniture.",
          kind: "furniture",
        }],
      },
    );
    const outcome = await workspaceActions.searchCandidates({ city: "Salt Lake City" });
    expect(outcome.refinementQuestions[0].question).toMatch(/large desk/i);
    expect(workspaceStore.getSnapshot().refinementQuestions[0]).toMatchObject({ origin: "agent_custom" });
  });

  it("adds a known human location as an approved distance anchor", async () => {
    workspaceActions.prepareSearch({ city: "Salt Lake City", state: "UT" });
    await workspaceActions.searchCandidates();

    const anchor = workspaceActions.addLocationAnchor("University of Utah");
    const state = workspaceStore.getSnapshot();

    expect(anchor.status).toBe("approved");
    expect(anchor.verification).toBe("verified_coordinates");
    expect(state.anchors.some((item) => item.id === anchor.id)).toBe(true);
    expect(state.candidates.every((candidate) => (
      candidate.distances.some((distance) => distance.anchorId === anchor.id)
    ))).toBe(true);
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
