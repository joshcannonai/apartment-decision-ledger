# Judge guide

## Fastest path

1. Open the live URL in ChatGPT's in-app browser, or in Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
2. Ask the browser agent:

   > Find apartments in Salt Lake City. Use only relevant context you already have about my budget, furniture, and important locations. Do not save anything yet.

3. The agent can call `prepare_search`, then `search_candidates`. The page should visibly show attributed pending context, 10 ranked demo candidates, evidence and uncertainty, and refinement questions.
4. Ask:

   > Review this workspace, add the University of Utah as an important location, sort around it, and compare the strongest two options.

5. The agent can call `review_workspace`, `propose_preferences`, `organize_results`, and `compare_candidates`. The location appears in the map context, the cards reorder, and the comparison opens on the same page.
6. Ask the agent to stage its leading recommendation. `stage_decision` creates a reversible on-page recommendation; it never contacts a property or commits the renter.

## Deterministic fallback

Select **Use Salt Lake City demo**. This exercises the same domain state as the WebMCP tools without requiring credentials or a live listing provider.

## Expected tool inventory

`prepare_search`, `review_workspace`, `propose_preferences`, `search_candidates`, `organize_results`, `add_candidate`, `compare_candidates`, `stage_decision`

All eight tools register anonymously at the app root. The human-only approval controls are intentionally not tools: agent context may shape the current search, but only the renter can approve it for durable workspace memory.
