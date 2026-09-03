# Verification report

Verified locally on September 2, 2026.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript project references | Passed |
| ESLint | Passed |
| Vitest | 9 files, 32 tests passed |
| Production build | Passed |
| Full npm dependency audit | 0 vulnerabilities |
| Native Chrome WebMCP discovery | 8 of 8 tools registered |
| Native Chrome WebMCP execution | 8 of 8 tools invoked successfully |
| Browser console and page errors | 0 |
| Deterministic demo results | 10 |
| Responsive screenshot states | 9 states: empty, workspace, Updated answer, Run 2 loading, Run 2 ready, mobile results, mobile decision, mobile refinement, added-location map |
| Progressive media sequence | Kitchen/living overview first, first five result images, gallery with floor plan fourth, then ranks 6–10 one at a time |
| Layout detector | 0 findings across the changed application surfaces |
| Refinement history | Run 1 remains selectable while Run 2 searches and after it is ready |
| Location preview | Keyless personal-list map preview rendered; University of Utah added with verified coordinates and used for distance sorting |

## Local media benchmark

Seven fresh Chrome contexts measured from demo activation. This is the deterministic local demonstration with project-owned local WebP media, not a live provider-wide apartment search and not browser-agent reasoning.

| Milestone | Average | Median | P95 |
| --- | ---: | ---: | ---: |
| Results visible | 107 ms | 113 ms | 132 ms |
| Lead image visible | 124 ms | 121 ms | 139 ms |
| First five result images visible | 125 ms | 122 ms | 139 ms |
| Selected four-image gallery visible | 130 ms | 126 ms | 163 ms |
| All ten result images visible | 1,592 ms | 1,582 ms | 1,627 ms |
| Refinement Run 2 ready | 362 ms | 361 ms | 365 ms |

The Run 2 measurement begins when the explicit rerun control is selected. The deterministic demo intentionally keeps its searching state visible for at least 320 ms; it does not represent a live provider request.

## Per-tool WebMCP ladder

All tools were tested on the anonymous local application with Chrome's native `document.modelContext` surface. The QA harness discovers each registered tool with `getTools()`, invokes it with `executeTool()`, checks its structured result, and verifies the declared visible page effect.

| Tool | Registration | Invocation and visible effect | State |
| --- | --- | --- | --- |
| `prepare_search` | Present anonymously | Query and pending attributed context prepared; visible with results | verified |
| `review_workspace` | Present anonymously | Compact active run, leading IDs, pending context, questions, comparison, and decision state returned without mutation | verified |
| `propose_preferences` | Present anonymously | New agent proposal appeared in the context panel | verified |
| `search_candidates` | Present anonymously | 10 source-linked demo candidates rendered before refinement questions | verified |
| `organize_results` | Present anonymously | Market Value ordering applied to the visible list | verified |
| `add_candidate` | Present anonymously | Public URL candidate appeared as unverified and enrichment-required | verified |
| `compare_candidates` | Present anonymously | Two-candidate comparison sheet opened | verified |
| `stage_decision` | Present anonymously | Reversible staged recommendation and rationale appeared | verified |

No tool called a paid API, contacted a landlord, applied for housing, sent a message, made a payment, or signed a lease during verification. Demo images are project-owned illustrative media and are visibly labeled as not being listing evidence.
