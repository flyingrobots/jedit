# Durable Decision Discipline

This document owns the workflow policy for recording durable decisions. It is
the canonical home; `AGENTS.md` links here and adds only agent-specific
enforcement.

Important decisions are incomplete until their durable owner is current.
Architecture, authority, identity, causal-settlement, recovery, compatibility,
ownership, public-API, and release-boundary decisions MUST be recorded in the
same change in the canonical document that owns the concept. Chat transcripts,
Think memories, pull-request prose, and review threads may explain or motivate
a decision, but they are not its canonical repository home.

## For every such decision

1. Identify one canonical owner before completing the change.
   `ARCHITECTURE.md` owns repository-wide doctrine;
   `docs/jim-component-ownership.md` owns the Jim/Jedit/Edict/Echo target
   ownership and causal model; a focused `docs/design/` document owns a design
   cycle; `docs/method/` owns workflow policy; and `docs/BEARING.md` owns current
   execution gravity.
2. Record the accepted rule, its current-versus-target posture, and explicit
   refinement, supersession, dependency, and related-document edges.
3. Update the relevant documentation entrance or router when a durable page is
   added, moved, or renamed.
4. Link to the canonical owner from reader-specific pages instead of copying
   the same rule into several places.
5. Keep implementation checklists in their cycle owner and live review or
   delivery status in GitHub. Architecture documents define durable truth; they
   are not a second pull-request dashboard.
6. Revisit the same canonical owner whenever later work refines the decision.
   A refinement is not complete while code, schemas, packages, runtime
   evidence, or release behavior disagree with the documented rule.

## Ownership register

| Concept | Canonical owner |
| --- | --- |
| Repository-wide architecture doctrine | `ARCHITECTURE.md` |
| Jim/Jedit/Edict/Echo target ownership and causal model | `docs/jim-component-ownership.md` |
| A design cycle | the focused `docs/design/` document for that cycle |
| Workflow policy, including this policy | `docs/method/` |
| Current execution gravity | `docs/BEARING.md` |

Rule 1 applies to this document too: workflow policy belongs in `docs/method/`,
which is why the policy body lives here rather than in `AGENTS.md`.
