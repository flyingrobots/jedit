---
title: unsaved-change-guardrails
lane: asap
owner: jedit editor
priority: medium
keywords:
  - save
  - quit
  - dirty
  - guardrails
  - editor
acceptance_criteria:
  - jedit warns before destructive actions that would drop unsaved changes.
  - Quit, close, and file-switch flows have a defined posture when the active buffer is dirty.
  - The dirty marker in the title/footer stays consistent with the actual save state.
  - The guardrail UX stays terse and keyboard-first.
---

# unsaved-change-guardrails

Add the minimum lawful save/quit protection so the editor does not casually let
the user destroy work.

Context:

- `jedit` now has real editing, save, preview, drawer interaction, and growing
  buffer navigation needs.
- That makes accidental loss more likely unless quit/close/switch behavior is
  explicit.

This is not about modal dialog theatrics. It is about a strong default posture
that respects dirty buffers.

## Non-Goals

- Full autosave.
- Session recovery or crash journal design.
