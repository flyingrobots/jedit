---
title: startup-modal-activity-picker
lane: cool-ideas
owner: jedit ui
priority: medium
keywords:
  - startup
  - modal
  - activity
  - workspace
  - echo-history
---

# startup-modal-activity-picker

Extend the startup file modal into a richer activity picker after the
current-directory path is stable.

The current modal deliberately starts with `WorkspaceModel.entries` so it can
reuse the existing file-open and directory-navigation paths. A future iteration
could add additional tabs or sections without replacing that foundation:

- current directory files;
- recently opened files from jedit-owned local posture;
- recent Echo receipts or retained readings relevant to the workspace;
- project roots discovered from explicit user action.

Acceptance:

- The current-directory section remains available and deterministic.
- Any Echo activity section names the receipt, basis, and evidence posture
  instead of presenting activity as an opaque log line.
- Project or recent-file state is jedit-owned UI state, not Echo core state.
- The picker still fits the Bijou small-terminal posture and falls back to the
  existing minimum-terminal notice.
- Tests cover section switching, filtering, selection, and opening without
  bypassing the production text authority path.
