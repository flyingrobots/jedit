---
title: observer-plan-explainer-panel
lane: cool-ideas
owner: jedit runtime
priority: medium
keywords:
  - observer
  - plan
  - explainer
  - ui
  - jedit
acceptance_criteria:
  - The idea describes one panel or debug surface that shows authored family, generated plan, and runtime reading together.
  - The idea stays an explainer/debug surface rather than turning into product clutter by default.
---

# observer-plan-explainer-panel

Create a developer-facing explainer panel or debug view that shows the whole
observer path for one app-owned read slice:

- authored family
- generated plan artifact
- current runtime reading envelope

Why it is interesting:

- it would make the app/runtime split legible
- it would help catch authority drift quickly
- it would turn a lot of abstract doctrine into one concrete local view

This is not a requirement for the product's main UI. It is a powerful
developer-facing teaching and debugging surface.

