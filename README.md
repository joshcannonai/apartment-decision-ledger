# Apartment Decision Ledger

An agent-native apartment decision workspace for the OpenAI WebMCP Challenge.

The renter's personal agent brings only the context it chooses to share. The page turns that context into visible assumptions, a ranked preliminary shortlist, transparent market-value and personal-fit reasoning, refinement questions, comparisons, and a reversible staged decision.

## Product boundary

- Complete anonymous experience; sign-in is not required.
- Results before questionnaire: a location is enough to produce a preliminary shortlist.
- Preferences and location anchors are visibly attributed and require approval before durable saving.
- Market Value Score and Personal Fit Score remain separate.
- No applications, bookings, landlord messages, payments, or lease commitments.
- No claim of access to a user's complete ChatGPT memory.
- No images in v0.1; candidate facts remain useful while an authorized media path is evaluated.

## WebMCP tools

The application registers seven imperative browser tools through `@nekuda/webmcp-sdk`:

1. `prepare_search`
2. `propose_preferences`
3. `search_candidates`
4. `organize_results`
5. `add_candidate`
6. `compare_candidates`
7. `stage_decision`

Every tool calls the same page-owned domain actions as the human interface and produces a visible page effect.

## Local development

```bash
npm install
npm run dev
```

The deterministic Salt Lake City demo does not require credentials.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

With the app running at `http://127.0.0.1:4173`, Chrome 150+ can execute the native browser verification:

```bash
npm run qa
```

The QA pass discovers and invokes all seven WebMCP tools in an isolated anonymous workspace, verifies visible UI effects, checks persistence and responsive rendering, captures three local screenshots, and fails on browser console errors.

## Optional nationwide provider

Live nationwide search is disabled by default. Copy `.env.example`, apply `db/001_provider_budget_and_cache.sql` to a dedicated Neon database, and configure the RentCast variables only when ready.

The live adapter:

- requires an atomic database reservation before each uncached RentCast request;
- defaults to 45 requests per month, below the 50-request free allocation;
- caches normalized searches;
- returns an honest demo fallback when unavailable;
- exposes no browser credentials;
- does not pretend RentCast supplies photos or original listing links.

## Submission status

The local product, deterministic demo, submission copy, demo script, and verification harness are complete. Typecheck, lint, 18 tests, production build, native Chrome WebMCP execution, and the full npm security audit pass.

Publishing a GitHub repository, deploying to Vercel, enabling paid providers, recording/uploading the demo video, and submitting the entry remain separate approval-time actions.
