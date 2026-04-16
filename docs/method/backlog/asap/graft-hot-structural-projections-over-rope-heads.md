---
title: "graft-hot-structural-projections-over-rope-heads"
lane: asap
owner: "jedit editor"
priority: high
keywords:
  - "graft"
  - "structured-buffer"
  - "syntax"
  - "folds"
  - "diagnostics"
  - "projections"
acceptance_criteria:
  - `jedit` has a clear adapter contract for asking Graft for structural projections over current rope heads or equivalent live buffer snapshots.
  - The design covers syntax spans, folds, diagnostics, node lookup, structural selection, rename preview, and semantic summary.
  - The contract is explicit that these surfaces are warm projections over hot text truth, not a replacement for the rope-worldline.
  - The design is honest about unsupported languages, partial parses, and stale-versus-current posture.
---

# graft-hot-structural-projections-over-rope-heads

Define how Graft should interpret live editor truth.

Context:

- Graft already has a strong `StructuredBuffer` surface for dirty in-memory
  content, but it is still a parsed snapshot API.
- `jedit` wants Graft-backed syntax highlighting, folding, diagnostics,
  structural selection, and AST-aware lenses that feel live while typing.
- That only works if Graft follows current rope heads or transaction heads
  rather than waiting for Git commits.

This note should lock the adapter seam between hot text truth and warm
structural intelligence.

## Non-Goals

- Making Graft the canonical editable buffer runtime.
- Solving every language or parser coverage problem up front.
- Designing cold Git witness storage.
