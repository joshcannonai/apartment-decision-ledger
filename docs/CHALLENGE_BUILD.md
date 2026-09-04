# WebMCP Challenge build record

Apartment Ledger was created during the WebMCP Challenge submission period. The repository's first commit is dated August 31, 2026, after the submission period opened on August 25, 2026.

## Challenge-period implementation

| Commit | Date (Mountain time) | Meaningful addition |
| --- | --- | --- |
| `478171a` | Aug 31 | Initial shared apartment workspace and seven WebMCP tools |
| `b642c91` | Aug 31 | Production-quality responsive interface |
| `06452a3` | Sep 1 | Progressive decision media and refinement workflow |
| `67a7226` | Sep 1 | Preserved ranking runs and compact decision view |
| `f5136f0` | Sep 1 | Decision-summary hierarchy |
| `e8049d1` | Sep 1 | Transparent score and fit reasoning |
| `f0be076` | Sep 1 | Map-based location context and distance sorting |

The final challenge-period build added a read-only workspace-resumption tool, original sample media, licensing, judge instructions, and a draft public submission package. Apartment Ledger was not submitted before the deadline and now continues as an open-source project.

Run `git log --format='%h %aI %s' --reverse` to verify the timestamped history.

## What is deliberately outside the claim

- The Salt Lake City demonstration is a dated, source-linked research snapshot, not live market-wide inventory.
- Illustrative media is original challenge media and is not evidence of a particular listing.
- The optional RentCast adapter is disabled unless a deployer supplies credentials and a database-backed request ledger.
- No application, landlord message, payment, booking, signature, or automatic transfer of model-provider memory is implemented.
