---
title: anchor-editor-integration
lane: asap
owner: jedit editor
priority: medium
keywords:
  - anchors
  - editor
  - selections
  - diagnostics
blocked_by:
  - interval-anchor-semantics
acceptance_criteria:
  - The editor-facing model uses anchor semantics for at least selections and one additional range-bearing concept such as diagnostics, comments, or AI targets.
  - Edits update those editor-facing ranges through the anchor law instead of ad hoc offset math.
  - The cycle does not widen the text-domain contract; it consumes the existing point and interval semantics.
---

# anchor-editor-integration

Wire stable anchor semantics into the editor-facing model so selections,
comments, diagnostics, and AI target ranges can survive text edits.

This slice belongs after the anchor law is stable. The point is to prove the
editor can consume the domain semantics cleanly instead of growing more ad hoc
offset logic.

## Non-goals

- [ ] Redesigning the editor shell.
- [ ] Echo adapter work.
- [ ] Storage or persistence work.
