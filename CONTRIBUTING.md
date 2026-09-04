# Contributing to Apartment Ledger

Apartment Ledger welcomes focused issues and pull requests that improve evidence quality, provider portability, accessibility, WebMCP behavior, or the apartment decision workflow.

## Local setup

```bash
npm install
npm run dev
```

The Salt Lake City sample workspace works without credentials. Never commit API keys, database URLs, private renter context, scraped marketplace data, or media you do not have permission to redistribute.

## Before opening a pull request

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Changes to WebMCP registration or browser-visible behavior should also pass `npm run qa` against a local production build.

## Product rules

- Keep provider integrations behind the normalized candidate boundary.
- Preserve source URLs, observation times, evidence grades, and explicit unknowns.
- Do not represent sample or cached data as live.
- Do not add automated applications, landlord messages, payments, signatures, or lease commitments.
- Agent context must be relevant, attributed, and visible before any durable saving.
- Prefer authorized APIs and user-supplied public URLs over marketplace scraping.

Architectural vocabulary belongs in [`CONTEXT.md`](CONTEXT.md); stable behavior belongs in [`SPEC.md`](SPEC.md); surprising hard-to-reverse choices belong in `docs/adr/`.
