# Verification report

Verified locally on August 31, 2026.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript project references | Passed |
| ESLint | Passed |
| Vitest | 6 files, 18 tests passed |
| Production build | Passed |
| Full npm dependency audit | 0 vulnerabilities |
| Native Chrome WebMCP discovery | 7 of 7 tools registered |
| Native Chrome WebMCP execution | 7 of 7 tools invoked successfully |
| Browser console and page errors | 0 |
| Deterministic demo results | 15 |
| Responsive screenshot states | Empty desktop, workspace desktop, mobile results, mobile decision, mobile refinement |

## Per-tool WebMCP ladder

All tools were tested on the anonymous local application with Chrome's native `document.modelContext` surface. The QA harness discovers each registered tool with `getTools()`, invokes it with `executeTool()`, checks its structured result, and verifies the declared visible page effect.

| Tool | Registration | Invocation and visible effect | State |
| --- | --- | --- | --- |
| `prepare_search` | Present anonymously | Query and pending attributed context prepared; visible with results | verified |
| `propose_preferences` | Present anonymously | New agent proposal appeared in the context panel | verified |
| `search_candidates` | Present anonymously | 15 source-linked demo candidates rendered before refinement questions | verified |
| `organize_results` | Present anonymously | Market Value ordering applied to the visible list | verified |
| `add_candidate` | Present anonymously | Public URL candidate appeared as unverified and enrichment-required | verified |
| `compare_candidates` | Present anonymously | Two-candidate comparison sheet opened | verified |
| `stage_decision` | Present anonymously | Reversible staged recommendation and rationale appeared | verified |

No tool called a paid API, contacted a landlord, applied for housing, sent a message, made a payment, or signed a lease during verification.
