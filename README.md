# Apartment Ledger

An open-source, agent-native workspace for making apartment decisions with visible evidence, preferences, uncertainty, and tradeoffs.

**Live app:** [apartmentledger.vercel.app](https://apartmentledger.vercel.app/)

![Apartment Ledger workspace](docs/images/workspace-submission.webp)

Apartment Ledger gives a renter and their browser agent one shared workspace. The agent can contribute only the apartment-relevant context it chooses to share, while the renter can inspect what shaped the ranking, refine it, and keep the final decision under human control.

## What works today

- Anonymous use with versioned browser-local workspace persistence.
- Familiar search fields for rental type, budget, bedrooms, timing, and free-form needs.
- Separate Market Value, Personal Fit, and transparent Recommended scores.
- Attributed agent context that requires human approval before durable saving.
- Numbered ranking runs that preserve the earlier result set after refinement.
- Interactive Google Maps previews, user-defined location anchors, and distance sorting.
- Source freshness, evidence grades, missing facts, and verification prompts.
- A deterministic Salt Lake City sample workspace that requires no credentials.
- An optional server-side RentCast adapter for nationwide active listings.
- Listing URL import through WebMCP as explicitly unverified evidence.

Apartment Ledger does not apply for housing, contact landlords, make payments, sign leases, or claim access to a user's complete model-provider memory.

## Quick start

```bash
git clone https://github.com/joshcannonai/apartment-decision-ledger.git
cd apartment-decision-ledger
npm install
npm run dev
```

Open the local URL and select **Use Salt Lake City demo**. No account or API key is required.

## Real listing data

The decision workspace is independent of any listing marketplace. Candidate data can arrive through three explicit modes:

1. **Sample workspace:** project-owned, dated demonstration data.
2. **Provider adapter:** the included RentCast adapter can return active listings across the United States.
3. **Listing import:** an agent can add a public listing URL as unverified evidence for enrichment and review.

To enable RentCast, copy `.env.example`, apply `db/001_provider_budget_and_cache.sql` to a dedicated Neon database, and configure:

```bash
ENABLE_LIVE_RENTCAST=true
VITE_ENABLE_LIVE_SEARCH=true
RENTCAST_API_KEY=your_server_side_key
DATABASE_URL=your_neon_connection_string
```

The adapter uses an atomic monthly request cap and shared cache. RentCast listing records do not currently provide the original marketplace URL or rich listing media, so the UI identifies those facts as missing instead of fabricating them. See [`docs/PROVIDER_ADAPTERS.md`](docs/PROVIDER_ADAPTERS.md).

## WebMCP

The application registers eight browser tools through `@nekuda/webmcp-sdk` against the native `document.modelContext.registerTool(...)` surface:

| Tool | Purpose |
| --- | --- |
| `prepare_search` | Prepare visible search fields and attributed agent context |
| `review_workspace` | Read compact current decision state without scraping the page |
| `propose_preferences` | Add visible preference, location, or follow-up proposals |
| `search_candidates` | Run the search and preserve numbered ranking runs |
| `organize_results` | Sort the current candidate set without another provider request |
| `add_candidate` | Import a public listing URL as unverified evidence |
| `compare_candidates` | Return a structured comparison to the requesting agent |
| `stage_decision` | Stage a reversible recommendation for human review |

The human interface and WebMCP tools call the same page-owned domain actions. Agent-originated changes that affect the shared workspace remain visible; read-only and agent-only structured results do not pretend to create UI state.

## Development and verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:media
```

With the production build running at `http://127.0.0.1:4173`, Chrome 150+ with WebMCP testing enabled can run the native browser verification:

```bash
npm run qa
```

The current verification suite covers 42 tests, all eight WebMCP tools, responsive workspace states, progressive media, interactive maps, separate-tab evidence links, and browser console failures. Details are in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Project contracts

- [`CONTEXT.md`](CONTEXT.md) defines the shared product language.
- [`SPEC.md`](SPEC.md) defines stable behavior and safety boundaries.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains the current implementation.
- [`docs/adr/0001-provider-adapter-boundary.md`](docs/adr/0001-provider-adapter-boundary.md) records why listing acquisition remains replaceable.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) explains how to contribute safely.

The original WebMCP Challenge work is retained as project history in [`docs/CHALLENGE_BUILD.md`](docs/CHALLENGE_BUILD.md). Apartment Ledger was not submitted before that challenge deadline; the repository now continues as an open-source product.

## License

[MIT](LICENSE)
