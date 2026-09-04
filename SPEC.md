# Apartment Ledger Product Contract

## Search and candidate evidence

- A search may use a sample workspace, an enabled provider adapter, or explicitly imported listing evidence.
- The source mode and freshness note must remain visible with the result set.
- Sample data must never be described as live inventory.
- Missing fees, availability, original URLs, media, or lease terms remain explicit unknowns.
- A provider failure may offer the sample workspace, but it must not relabel sample candidates as live results.

## Renter context

- The site receives only context included in a visible human action or a WebMCP tool call.
- Agent-originated preferences and location anchors are attributed to their source.
- Current-run context may influence ranking before approval, but durable preference saving requires a human approval action.
- Sign-in is optional and may not imply access to ChatGPT, Claude, or another provider's complete memory.

## Ranking

- Market Value and Personal Fit remain independently inspectable.
- Recommended ordering is derived from those scores and may not conceal missing evidence.
- Follow-up questions appear after an initial result set when possible.
- Applying a refinement creates a new numbered search run and preserves ready prior runs.

## Human and agent actions

- The human interface and WebMCP tools use the same domain actions and workspace state.
- Read-only tools do not mutate the workspace.
- Agent-only structured output does not claim a visible page effect.
- A staged decision is reversible and performs no external action.
- Apartment Ledger does not apply, book, pay, sign, or contact a landlord.

## Navigation and maps

- Embedded maps are interactive within the workspace.
- External listing, expanded-map, and route links open separately so the current decision context remains available.
- Straight-line distance is labeled as an estimate; live route claims belong to Google Maps or another authorized routing provider.

## Provider safety

- Provider credentials remain server-side and outside browser bundles.
- Paid or quota-limited providers require a bounded usage policy suitable for the deployment model.
- Provider responses are normalized as untrusted external content with source and observation metadata.
- A provider adapter may enrich candidates, but it may not redefine preferences, ranking history, or decision authority.
