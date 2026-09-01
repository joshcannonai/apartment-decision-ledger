# Demo script — target 2 minutes 30 seconds

## 0:00–0:18 — The problem

“Apartment search is usually either a giant filter form or a chat answer that disappears. Your personal agent may already know useful context, but a rental site cannot and should not receive the agent’s entire memory.”

Show the empty anonymous workspace.

## 0:18–0:42 — Context without memory transfer

Prompt the browser agent:

> Find apartments in Salt Lake City. Use the relevant context you have, including that I need room for a 72-inch desk and value convenient groceries, but do not save anything yet.

The agent calls `prepare_search` and `propose_preferences`. Show attributed proposals in the page and emphasize that they affect only the current search until approved.

## 0:42–1:08 — Results before questionnaire

The agent calls `search_candidates`. Up to 15 candidates render immediately with visible assumptions.

Show:

- base and estimated all-in cost;
- Market Value Score;
- Personal Fit Score;
- evidence grade and freshness;
- why the apartment fits;
- unknowns that must be verified.

Then reveal **Answer these to enhance and narrow your search**. Explain that the product gives value before asking nonessential questions.

## 1:08–1:32 — Personal locations and transparent reranking

The agent proposes relevant location anchors and the page shows their source and confidence. Confirm one anchor and reject or reweight another.

Ask the agent to sort by Market Value Score, then by distance to the selected anchor. The agent calls `organize_results`; the same visible candidate set changes order without another market fetch.

## 1:32–2:02 — Shared decision workspace

Ask:

> Compare the three strongest options and show me what could change the recommendation.

The agent calls `compare_candidates`. Show the side-by-side decision view with cost, fit, value, evidence, and unresolved checks.

## 2:02–2:20 — Human approval boundary

The agent calls `stage_decision`. Show the reversible recommendation and the still-pending preference approvals.

“The agent can research, organize, and recommend. Only the renter can make preferences durable or take consequential housing action.”

## 2:20–2:30 — Closing

“Your agent already knows the goal. Apartment Decision Ledger makes the tradeoffs, uncertainty, and next decision visible.”
