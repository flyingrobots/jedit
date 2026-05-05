---
title: fake-echo-causal-ux-demo-spine
lane: asap
owner: jedit editor
priority: high
keywords:
  - demo
  - echo
  - optic
  - ux
  - causal
acceptance_criteria:
  - A demo path exercises open, bounded read, edit, receipt, checkpoint, proposal preview, and proposal accept through the fake Echo-shaped transport.
  - The user-facing UI does not branch on fake runtime internals.
  - The central editor remains the default surface and does not show a permanent causal debug log.
  - Tests or scripted fixtures cover the happy path and one stale-basis obstruction.
  - The demo can be run before the real Echo Optic API exists.
---

# fake-echo-causal-ux-demo-spine

Build the first product-visible fake Echo causal editing demo.

Context:

- The architecture needs a fake Echo harness before real Echo Optics are ready.
- The product needs a real-feeling loop so the human can judge checkpoint,
  proposal, obstruction, and pane posture.
- The demo should prove the app boundary and the editor feeling at the same
  time.

The narrow spine is:

```text
Open -> Read Window -> Edit -> Receipt -> Checkpoint -> Proposal -> Preview -> Accept
```

The fake may use a simple in-memory causal text runtime internally. The app
surface must still speak in readings, Intents, receipts, obstructions,
checkpoints, and proposals.

## Non-Goals

- Real Echo persistence.
- A full time rail.
- A broad AI assistant UI.
- Git export or Git-derived dirty state.
