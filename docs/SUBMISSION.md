# Submission draft

## Project title

Apartment Decision Ledger

## One-line description

A personal agent brings only relevant renter context; a WebMCP-enabled page turns it into a transparent, reviewable apartment decision.

## Description

Apartment Decision Ledger is an agent-native apartment search and comparison workspace. Instead of making renters repeat a long preference form, their browser agent can pass only the structured context relevant to the current search, such as budget signals, furniture constraints, lease flexibility, or important locations.

The page produces a useful preliminary shortlist before asking nonessential questions. It streams the leading apartment image first, then visible shortlist and supporting images without blocking the facts. Every photo is source-linked and labeled as exact-unit, building, or community media. It separates Market Value Score from Personal Fit Score, estimates all-in costs without hiding unknown fees, preserves source and freshness, and makes every agent-supplied preference visible and attributed. The renter can then sort, add a candidate found elsewhere, compare finalists, and review a reversible staged recommendation.

Seven imperative WebMCP tools operate the same domain actions as the human interface, so every agent call visibly changes the shared workspace. No remote MCP is required. No application, landlord message, payment, or lease action is automated, and preferences do not become durable without human approval.

The included Salt Lake City demonstration is deterministic and source-linked. An optional server adapter supports bounded nationwide RentCast search when credentials and an atomic usage ledger are configured.

## WebMCP tools

- `prepare_search`
- `propose_preferences`
- `search_candidates`
- `organize_results`
- `add_candidate`
- `compare_candidates`
- `stage_decision`

## Differentiator

The agent does not merely click a faster filter form. It contributes relevant personal context while the website contributes persistent domain evidence, transparent scoring, uncertainty, comparison state, and approval boundaries. Neither side replaces the other.

## Links to complete before submission

- Live WebMCP URL: pending deployment approval
- Public source repository: pending publication approval
- Public demo video under three minutes: pending capture and upload
