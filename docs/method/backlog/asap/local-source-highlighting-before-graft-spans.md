---
title: local-source-highlighting-before-graft-spans
lane: asap
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
