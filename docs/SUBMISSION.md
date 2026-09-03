# Devpost submission draft

## Project title

Apartment Ledger

## Tagline

Your agent already knows the goal. This page makes the tradeoffs, uncertainty, and next decision visible.

## One-line description

A personal agent contributes only relevant renter context; a WebMCP page turns it into a transparent, reviewable apartment decision.

## Inspiration

Apartment search forces people into one of two bad experiences: a long generic filter form, or an AI answer whose assumptions and evidence disappear inside a chat. A personal agent may already know that its user owns a 72-inch desk, prefers character over generic luxury, or regularly needs to reach a particular part of town. Re-entering all of that is tedious, but handing a website the user's complete AI memory would be invasive.

Apartment Ledger explores a narrower and safer idea: the agent shares only the structured context relevant to this search, and the website turns it into a visible decision workspace the renter controls.

## What it does

The renter can begin with only a city. The page produces a useful preliminary shortlist before asking optional questions. It separates estimated all-in cost, Market Value, and Personal Fit; preserves source freshness and unknowns; and explains why each apartment occupies its rank.

The agent can contribute budget signals, furniture constraints, lifestyle preferences, lease flexibility, and important locations. Every contribution is visibly attributed and remains pending for durable saving until the renter approves it. A renter can add a location, preview it on a built-in map, rerank by distance, preserve multiple ranking runs, compare finalists, and stage a reversible recommendation.

The Salt Lake City demo uses a deterministic, dated, source-linked listing snapshot. Original illustrative media keeps the demonstration visually useful without presenting a generic image as evidence of a specific unit.

## Why WebMCP is essential

WebMCP is not an add-on automation layer here. It is the collaboration boundary between two complementary kinds of context:

- the personal agent knows the renter's goals and can choose the small subset relevant to apartment search;
- the website knows candidate evidence, costs, scoring, source freshness, location distances, comparison state, and approval rules.

Eight imperative WebMCP tools call the same page-owned domain actions as the human interface. Agent calls visibly prepare searches, add attributed context, render or reorder candidates, focus location evidence, open comparisons, and stage recommendations. The read-only `review_workspace` tool lets an agent resume an existing decision without scraping the interface. Neither side replaces the other, and there is no hidden remote MCP state competing with the page.

This makes a previously awkward workflow possible: a renter can tell their agent only “help me find an apartment,” receive an immediate personalized first pass, inspect exactly what shaped it, answer only the questions that would materially change the ranking, and continue making the decision in the same visible workspace.

## How it was built

The app is a React and TypeScript SPA. `@nekuda/webmcp-sdk` defines and registers the tools against the browser's `document.modelContext` WebMCP surface. Each tool calls the application's client-side domain store rather than scraping the DOM. Tool schemas are bounded, third-party listing content is marked untrusted, and registration is cleaned up with the page lifecycle.

The deterministic demo requires no account or API key. An optional same-origin RentCast adapter is disabled by default and includes an atomic database-backed provider budget, cache, request validation, and an honest fallback.

## WebMCP tools

| Tool | Shared outcome |
| --- | --- |
| `prepare_search` | Prepares a city search and visibly attributes relevant agent context |
| `review_workspace` | Reads a compact current decision state without mutation |
| `propose_preferences` | Adds visible preferences, locations, or useful follow-up questions |
| `search_candidates` | Ranks up to 10 candidates and preserves numbered reruns |
| `organize_results` | Reorders current candidates without another provider search |
| `add_candidate` | Adds a public listing URL as explicitly unverified evidence |
| `compare_candidates` | Opens a visible two-to-four candidate comparison |
| `stage_decision` | Records a reversible recommendation for human review |

## Safety and privacy

- The site never receives a user's complete ChatGPT memory.
- Only context explicitly included in a tool call reaches the page.
- Agent-proposed context is visible and attributed.
- Human approval is required before a preference becomes durable workspace memory.
- Listing claims retain their source, date, evidence grade, and unknowns.
- No housing application, booking, payment, message, signature, or lease commitment is available to an agent.

## Links

- Live WebMCP URL: https://apartment-decision-ledger.vercel.app/
- Public source repository: https://github.com/joshcannonai/apartment-decision-ledger
- Public YouTube demo: pending capture and upload
