# Apartment Decision Context

Apartment Ledger helps a renter and an agent build one inspectable decision from candidate evidence and renter-owned context. It is not a listing marketplace or an autonomous leasing service.

## Language

**Workspace**:
The renter-controlled state containing the current search, candidate evidence, context proposals, ranking runs, and staged decision.
_Avoid_: Chat transcript, agent memory

**Candidate**:
One possible rental represented by attributed facts, unknowns, location context, and scores. A candidate is not assumed to be currently available unless its source establishes that.
_Avoid_: Verified apartment, guaranteed listing

**Search run**:
An immutable ranked candidate snapshot produced from the context available at that moment. A refinement creates a new run instead of rewriting the previous one.
_Avoid_: Results refresh

**Context proposal**:
An apartment-relevant preference or constraint contributed by a user or agent. It may affect the current search but does not become durable preference memory until the renter approves it.
_Avoid_: Imported memory, known fact

**Location anchor**:
A place whose distance or route matters to the renter and may affect ranking when its coordinates are known.
_Avoid_: User location, tracked location

**Provider adapter**:
A replaceable source of candidate records that conforms to Apartment Ledger's candidate contract. It does not own ranking, preferences, decisions, or the WebMCP interface.
_Avoid_: Apartment Ledger backend, universal scraper

**Sample workspace**:
A dated, project-owned candidate set used to demonstrate the complete decision workflow without representing live availability.
_Avoid_: Live search, verified inventory

**Evidence grade**:
A compact statement of how directly a source supports the displayed candidate claims. It is not a promise that every listing fact is correct or current.
_Avoid_: Accuracy score

**Staged decision**:
A reversible leading recommendation recorded for human review. It performs no external housing action.
_Avoid_: Selection, application, booking
