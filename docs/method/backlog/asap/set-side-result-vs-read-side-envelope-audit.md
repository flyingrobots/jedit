---
title: set-side-result-vs-read-side-envelope-audit
lane: asap
owner: jedit runtime
priority: high
keywords:
  - result
  - reading
  - receipt
  - envelope
  - jedit
acceptance_criteria:
  - The repo audits where `jedit` currently treats mutation result, receipt, and later reading as distinct versus blurred.
  - The audit names any places where app code accidentally collapses set-side and read-side boundaries.
  - The output leaves one explicit rule for future work: mutation result and later reading remain separate surfaces even when they share underlying contract families.
---

# set-side-result-vs-read-side-envelope-audit

Audit whether `jedit` is still cleanly separating:

- set-side intent result
- receipt or proof surface
- later read-side reading envelope

This matters because `jedit` is the app-boundary proving ground. If it blurs
those surfaces, the rest of the stack will likely follow.

Context:

- the hot-text contract already defines mutation families and a first read-side
  shape
- the runtime glue already wraps a `WorldlineSnapshotReadingEnvelope`
- that does not yet prove the full boundary is being respected everywhere

## Non-Goals

- Designing the final debugger protocol here.
- Inventing a new runtime family from scratch.
- Changing Echo semantics inside the `jedit` repo.

