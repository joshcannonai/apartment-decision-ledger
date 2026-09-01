# Architecture

## Product mechanism

Apartment Decision Ledger is a shared stateful workspace, not a chat transcript and not a listing marketplace clone.

```text
personal agent or human interface
              |
              v
      page-owned domain actions
              |
      anonymous workspace store
       /         |          \
 preferences  candidates  decision state
       \         |          /
              visible UI
```

The human interface and WebMCP tools call the same domain actions. WebMCP does not scrape the DOM, contact third-party providers directly, or maintain a competing state model.

## Search modes

### Verified demo

The default Salt Lake City experience uses a curated source-linked candidate pool. It demonstrates the entire human-agent workflow without credentials, paid calls, or claims of live market-wide completeness.

### Optional nationwide adapter

`POST /api/search` can query RentCast when explicitly enabled. The server:

1. validates and bounds the request;
2. serves a fresh database cache when available;
3. atomically reserves one of the configured monthly provider calls;
4. calls RentCast from the server only;
5. normalizes and bounds the response;
6. caches the result;
7. labels photos and original listing links unavailable because RentCast does not supply them in its published rental-listing response.

No database means no reliable cross-instance budget reservation, so live search remains disabled rather than weakening the cap.

## Scores

Market Value Score and Personal Fit Score remain separate.

- Market Value Score compares normalized cost with comparable candidates and reports confidence and basis.
- Personal Fit Score applies current-search and approved preferences, including explicit furniture and location-anchor constraints.
- Unknown fees and weak evidence reduce confidence rather than becoming optimistic defaults.

## Persistence

The first release uses a versioned anonymous workspace in browser storage. A later account layer may attach that workspace to a user after explicit authentication. Sign-in is never required for the challenge path and never imports model-provider memory.

## Safety boundaries

- Preferences require human approval before durable saving.
- Agent recommendations are staged and reversible.
- No applications, bookings, landlord messages, payments, or signatures exist.
- External listing content is treated as untrusted and source-attributed.
- API credentials stay server-side.
- Tools unregister with their page lifecycle.
