---
title: checkpoint-footer-posture
lane: asap
owner: jedit editor
priority: high
keywords:
  - checkpoint
  - footer
  - save
  - ux
  - causal
acceptance_criteria:
  - Saving through the demo submits a checkpoint Intent and receives checkpoint posture from the fake Echo-shaped transport.
  - The footer distinguishes current mode, focus owner, checkpoint identity, and ahead-of-checkpoint edit count without Git-shaped wording.
  - Dirty posture compares the current coordinate to the last checkpoint coordinate.
  - A stale or failed checkpoint path has a calm visible recovery message.
  - Tests cover footer strings for clean, ahead-of-checkpoint, and checkpoint obstruction states.
---

# checkpoint-footer-posture

Make save and dirty state feel like checkpoint truth in the editor footer.

Context:

- `jedit` should treat save as a checkpoint, not as Git authority.
- The footer is the right first surface for checkpoint posture because it
  carries operational truth without crowding the editor.
- The demo should let the human judge whether the wording is too quiet, too
  loud, or right.

The first version should prefer compact language:

```text
NORMAL | file.ts | checkpoint C12
NORMAL | file.ts | checkpoint C12 +1 edit
NORMAL | file.ts | checkpoint blocked: refresh needed
```

## Non-Goals

- Complete checkpoint history browsing.
- Git export status.
- A full save preferences UI.
