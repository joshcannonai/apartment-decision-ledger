# Archived demo script — target 2 minutes 20 seconds

Apartment Ledger was not submitted before the challenge deadline. This draft is retained as a concise product walkthrough.

The recording must show a real browser agent invoking WebMCP in the deployed application. Keep the tool-call UI visible whenever the browser permits it.

## 0:00–0:12 — Lead with the transformation

Show the empty page beside the agent prompt:

> Find apartments in Salt Lake City. Use the relevant context you already have about my budget, my 72-inch desk, and useful locations—but don't save anything yet.

The agent calls `prepare_search`. Pause long enough to show the familiar rental fields, budget rationale, and apartment-relevant context visibly prefilled, then call `search_candidates` and show the truthful search-progress state before the populated workspace.

Voiceover:

“Apartment search usually makes you repeat a generic form. Here, my agent contributes only the context relevant to this decision, and WebMCP turns it into a shared workspace.”

## 0:12–0:38 — Context without memory transfer

Show the pending desk, budget, and location context with source and confidence. Open **Review what shaped this ranking**.

“The website never receives my complete AI memory. Every signal is structured, attributed, visible, and useful for this search without being silently saved. Only I can approve durable preferences.”

## 0:38–1:02 — A decision, not a results dump

Show the first-ranked candidate, original illustrative media label, estimated all-in cost, Market Value, Personal Fit, AI ranking explanation, evidence grade, source link, and unknowns.

“The first result arrives before a questionnaire. Cost and market value stay separate from personal fit, and uncertainty never disappears behind one magic score.”

## 1:02–1:25 — Resume and reason about location

Prompt:

> Review this workspace. Add the University of Utah as an important location and sort around it.

The agent calls `review_workspace`, `propose_preferences`, then `organize_results`. Show the new location chip, map focus, and reordered candidates.

“Because the agent can read the compact workspace state, I can resume later without making it scrape the page or repeat the search. A location from the conversation becomes visible map and ranking context.”

## 1:25–1:49 — Refine without losing the first answer

Answer one suggested question, show **Updated**, and rerun. Show Run 1 remaining available while Run 2 loads, then the movement explanation.

“Follow-up questions come after useful output. A rerun never erases the original ranking, so I can see what my answer actually changed.”

## 1:49–2:10 — Human and agent close the loop

Prompt:

> Compare the strongest two options and stage your current recommendation.

Show the structured `compare_candidates` result, then call `stage_decision` and show the visible reversible decision.

“The agent can research, organize, compare, and recommend. It cannot apply, pay, message a landlord, sign, or make a preference durable for me.”

## 2:10–2:20 — Close

Show the workspace and eight-tool inventory.

“Your agent already knows the goal. Apartment Ledger makes the tradeoffs, uncertainty, and next decision visible.”
