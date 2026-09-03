# Apartment Ledger design system

This file encodes product-specific visual judgment for humans and coding agents. It follows the approach described in [Vercel's design.md article](https://vercel.com/blog/how-our-agents-build-on-brand-pages-with-design-md), while the resulting interface and brand remain original to Apartment Ledger.

## Product promise

Help a renter make a defensible apartment decision with relevant personal context and visible evidence. The interface should feel calm, specific, and trustworthy rather than luxurious, playful, or chat-like.

## First viewport decision

- Empty state: explain the differentiated outcome and preview the real decision workspace.
- Populated state: show ranked options, the selected apartment's best available image, compact actions, estimated all-in cost, space, Market Value, and Personal Fit.
- Supporting rationale, unknowns, saved context, and activity follow the decision summary rather than competing with it.

## Layout

- Desktop has three working regions: a narrow ranked shortlist, a flexible decision canvas, and a compact refinement rail.
- The shortlist is image-led and dense enough to show five candidates without scrolling on a typical laptop.
- The decision canvas uses a short lead image with a vertical supporting strip; the source action follows the final supporting image.
- Availability, layout, and location facts stack immediately beside the media.
- Estimated all-in cost, space, and larger Market Value and Personal Fit gauges form one compact metric row beneath the media and facts.
- A full-width “Why the AI ranked it here” explanation follows the metrics with the ranking reason, relevant cost and space context, the latest rerun input when applicable, and the most important remaining verification.
- The model-thought label sits directly above the explanation rather than consuming a separate left column.
- A lazy Google Maps location preview follows the decision summary. Location chips select a route, “Add location” sits beside those chips, and sorting is enabled only when an anchor has verified coordinates.
- The refinement rail asks only questions that can improve the ranking.
- Mobile separates Results, Decision, and Refine into explicit views instead of squeezing three rails together.

## Media priority and truth

1. Load the selected candidate's primary decision image first.
2. Load primary images for the first five ranked results.
3. Load the first three selected-candidate supporting images.
4. Load remaining result images during idle time.

When a verified floor-plan image exists, order it fourth. Do not classify an image as a floor plan from visual guesswork in the critical path; prefer provider metadata or a cached enrichment result.

Images never delay facts or ranking. Every image must identify its evidence scope as exact-unit, building, community, or illustrative. Illustrative challenge media is labeled “not listing evidence”; never imply that representative or illustrative media proves the condition or layout of an exact unit.

## Visual language

- Use cool neutral surfaces, near-black decisive actions, and a single cobalt accent.
- Prefer borders, alignment, and spacing over elevated card stacks.
- Use sentence case throughout.
- Use compact authored line icons. The brand mark is a floor-plan decision grid with one selected room.
- Rounded corners stay restrained: 6–12px for controls and frames, not soft pill-shaped everything.
- Typography is compact and editorial: high-contrast headings, small evidence metadata, and strong tabular numbers.

## Decision summary order

1. Estimated all in, with base rent subordinate in parentheses.
2. Space.
3. Market Value as a circular score.
4. Personal Fit as a circular score.

Market Value and Personal Fit must remain visually separate. Scores always appear with evidence caveats elsewhere in the same decision view.
Circular scores must display the true missing arc. A score of 97 cannot render as a complete ring.

## Refinement runs

- Base questions are deterministic and disappear as their information becomes known: budget, key locations, furniture or space constraints, move and lease window, pets, transportation, and noise sensitivity.
- An agent may supply a relevant custom question with a reason; it is labeled as an agent follow-up.
- Applying an answer marks it Updated but does not silently change the visible ranking.
- The explicit rerun creates a preserved numbered snapshot. Run 1 remains available while Run 2 searches and after it completes.
- The new run explains meaningful rank movement using the answer that triggered it.

## Disclosure rules

- Show the facts required for a first decision immediately.
- Put all agent-brought preferences and anchors behind “Review what shaped this ranking,” with proposal and saved counts visible while collapsed.
- Keep source, freshness, media scope, and material unknowns visible without opening a modal.
- Agent-supplied context may affect the current run, but saving it requires explicit human approval.

## Avoid

- A wall of equally weighted text cards.
- Large action panels for Compare or Stage leader.
- Generic building-logo imagery.
- Multiple accent colors competing for attention.
- Progress bars that make Market Value and Personal Fit look like one score.
- Decorative photography without source and scope.
- Hiding uncertainty to make a candidate look stronger.
- Requiring sign-in before the useful anonymous workflow.
