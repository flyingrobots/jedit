---
title: echo-history-worldline-jump
tags:
  - echo
  - history
  - workspace
---

# Echo History Worldline Jump

Add the port-backed Enter action for the Echo History drawer.

The drawer can already select workspace-visible Echo evidence rows. The missing
piece is a jedit-owned port that asks Echo for a bounded reading at the selected
evidence basis, then reprojects the editor without mutating current Echo
history.

Acceptance:

- Enter on a selected history row requests a bounded historical basis through a
  port, not through UI-local cache mutation.
- The editor view shows the selected historical reading.
- Footer or title posture makes historical-basis viewing explicit.
- Esc or a clear command returns to the current basis.
- Tests cover successful jump, obstruction, and current-history preservation.
