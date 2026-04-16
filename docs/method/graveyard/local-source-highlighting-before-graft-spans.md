---
title: local-source-highlighting-before-graft-spans
lane: graveyard
owner: jedit editor
priority: medium
keywords:
  - source
  - highlighting
  - local
  - fallback
  - ux
acceptance_criteria:
  - jedit can colorize common source constructs locally without requiring new Graft APIs.
  - The implementation stays explicitly limited to honest local syntax paint rather than pretending to be semantic understanding.
  - At minimum, comments, strings, numbers, and obvious keyword classes are visually distinguishable in supported local modes.
  - Unsupported or ambiguous languages fall back to plain source rather than misleading colorization.
---

# local-source-highlighting-before-graft-spans

## Disposition

This note assumed jedit needed a local-highlighting stopgap before Graft had a usable dirty-buffer syntax surface. Repo truth changed: Graft now exposes a real StructuredBuffer API with syntax spans and related structural projections over in-memory content. The queue should prefer the renderer seam plus Graft-backed warm projections rather than a local fallback-first plan.

Replacement: `docs/method/backlog/asap/source-render-pipeline-that-can-swap-local-and-graft-highlighting.md`

## Original Proposal

Ship useful local source paint before Graft buffer-aware syntax spans exist.

Context:

- The editor does not need to wait for new Graft features to become nicer to
  read.
- We already decided that fake AST claims are worse than honest local syntax
  paint.
- This note is the near-term user-facing improvement that sits on top of the
  renderer pipeline seam.

The important product posture is honesty:

- local syntax paint is allowed
- semantic claims are not
- dirty buffers must never masquerade as parser-backed truth

## Non-Goals

- AST-truthful semantic highlighting.
- Language-server style semantic token support.
- Perfect coverage for every language jedit may eventually open.
