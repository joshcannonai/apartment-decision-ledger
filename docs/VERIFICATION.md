# Verification report

Verified locally on September 3, 2026.

## Production read-back

The production site at `https://apartmentledger.vercel.app/` returned HTTP 200 and the expected WebMCP permissions policy on September 3, 2026. The native Chrome QA was then rerun against the production deployment: all eight tools registered and executed, 10 results rendered, eleven responsive states were captured, and no browser console or page errors were reported.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript project references | Passed |
| ESLint | Passed |
| Vitest | 11 files, 42 tests passed |
| Production build | Passed |
| Full npm dependency audit | 0 vulnerabilities |
| Native Chrome WebMCP discovery | 8 of 8 tools registered |
| Native Chrome WebMCP execution | 8 of 8 tools invoked successfully |
| Browser console and page errors | 0 |
| Deterministic demo results | 10 |
| Responsive screenshot states | 11 states: empty desktop, empty mobile, search progress, workspace, Updated answer, Run 2 loading, Run 2 ready, mobile results, mobile decision, mobile refinement, added-location map |
| Progressive media sequence | Kitchen/living overview first, first five result images, then ranks 6–10 one at a time |
| Layout detector | 0 findings across the changed application surfaces |
| Refinement history | Run 1 remains selectable while Run 2 searches and after it is ready |
| Location preview | Keyless personal-list map preview rendered; University of Utah added with verified coordinates and used for distance sorting |

## Local media benchmark

Seven fresh Chrome contexts measured from demo activation. This is the deterministic local demonstration with project-owned local WebP media, not a live provider-wide apartment search and not browser-agent reasoning.

| Milestone | Average | Median | P95 |
| --- | ---: | ---: | ---: |
| Results visible | 830 ms | 830 ms | 834 ms |
| Lead image visible | 839 ms | 839 ms | 844 ms |
| First five result images visible | 840 ms | 840 ms | 846 ms |
| All ten result images visible | 2,254 ms | 2,250 ms | 2,283 ms |
| Refinement Run 2 ready | 386 ms | 389 ms | 392 ms |

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
