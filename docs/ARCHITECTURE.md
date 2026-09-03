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

## Refinement and run history

The first search creates an immutable Run 1 candidate snapshot. Answers to deterministic or agent-supplied follow-up questions are queued as current-search context; they do not mutate the visible ranking until the renter explicitly reruns it. A rerun creates a searching Run 2 while Run 1 stays readable, then stores the newly scored candidates as another snapshot. The UI can switch between ready runs and explain movement against the previous run.

This is page-owned state, so the same behavior applies whether the answer came from a human control or a WebMCP-enabled agent. Saving a preference beyond the current anonymous workspace remains a separate approval action.

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

## Progressive media

Media never blocks the result set or ranking. Project-owned illustrative images load in four phases:

1. the selected leading candidate's primary decision image;
2. primary images for the five candidates visible in the first result viewport;
3. the first three supporting images for the selected candidate;
4. remaining selected and result images during browser idle time.

Media ordering is deterministic. A kitchen-to-living overview, great room, or other broad living-area view leads when its description identifies one; bedrooms, bathrooms, exteriors, and amenities do not displace a more informative overview. If trusted metadata marks a floor plan, it is placed fourth when three ordinary photos exist, otherwise at the latest available position. A future live adapter should enrich only the leading candidates from authorized provider media, cache that result, and keep page scraping out of the initial search path.

Every media record carries an observation time, alt text, and an explicit scope. The challenge demo uses project-owned generated media with the `illustrative` scope and labels it “not listing evidence.” The UI does not present an illustration, building exterior, or community gallery as proof of an exact unit. An image still awaiting enrichment uses a non-blocking loading surface and does not delay or remove the candidate facts.

## Persistence

The first release uses a versioned anonymous workspace in browser storage. A later account layer may attach that workspace to a user after explicit authentication. Sign-in is never required for the challenge path and never imports model-provider memory.

## Safety boundaries

- Preferences require human approval before durable saving.
- Agent recommendations are staged and reversible.
- No applications, bookings, landlord messages, payments, or signatures exist.
- External listing content is treated as untrusted and source-attributed.
- API credentials stay server-side.
- Tools unregister with their page lifecycle.
