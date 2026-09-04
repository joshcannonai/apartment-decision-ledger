# Provider adapters

Apartment Ledger keeps listing acquisition separate from the decision workspace. A provider adapter returns normalized candidates; the shared domain layer owns scoring, preferences, locations, ranking runs, and decisions.

## Current modes

### Sample workspace

The dated Salt Lake City data exercises the complete product without credentials. It is intentionally labeled as a sample and must not be used as evidence of current availability.

### RentCast

The included `/api/search` adapter queries active long-term rental listings and normalizes the response. It requires:

- `ENABLE_LIVE_RENTCAST=true`
- `VITE_ENABLE_LIVE_SEARCH=true`
- a server-side `RENTCAST_API_KEY`
- a Neon-compatible `DATABASE_URL`
- the schema in `db/001_provider_budget_and_cache.sql`

The database provides a cross-instance cache and atomic monthly request reservation. The default cap is 45 provider requests per month.

RentCast records provide broad listing facts but not the original marketplace URL or a rich photo gallery in the current adapter. Those remain visible unknowns.

### Listing URL import

The `add_candidate` WebMCP tool accepts a public URL and bounded facts. Imported facts are marked unverified until an authorized enrichment path confirms them.

## Adding another adapter

Implement the `SearchClient` contract from `src/domain/types.ts` and return bounded `ExternalCandidate` objects. Each candidate must include:

- a stable provider-derived ID;
- source label, URL when available, and observation time;
- nullable factual fields instead of optimistic defaults;
- explicit unknowns for information the provider does not establish;
- media scope and provenance when media redistribution is authorized.

Do not expose credentials to the browser. Do not scrape presentation markup as the normal search path. If an adapter can incur spend, document and enforce its deployment-safe budget policy.
