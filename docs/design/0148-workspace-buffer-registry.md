---
title: "WF-0124 - Workspace Buffer Registry"
legend: "WF"
lane: "design"
status: "draft"
owners:
  - "@flyingrobots"
created: "2026-06-27"
updated: "2026-06-27"
---

# WF-0124 - Workspace Buffer Registry

## Decision Summary

Jim needs a real buffer registry. One active `editor` plus one active
`textAuthority` is enough for a single-file proof, but it collapses buffer
identity, path binding, view state, Graft enrichment, source highlighting, and
materialization posture into one mutable slot. That makes switching files look
like a destructive reopen, even when Echo has durable causal work for the
inactive buffer.

This design introduces `WorkspaceBufferRecord` as the durable workspace-level
record for a causal editing subject. The current UI can still show one active
pane, but switching files should activate a buffer record instead of throwing
away inactive local/session state.

## Doctrine

- A buffer is a durable causal editing subject.
- A path binding is a materialization target, not the buffer itself.
- A pane or editor view is a lens over a buffer/frontier.
- Graft and source highlighting are auxiliary projections, not text truth.
- Dirty/materialization posture is derived from the active buffer authority.

## Model Shape

The target registry shape is:

```ts
interface WorkspaceBufferRecord {
  bufferId: string;
  pathBinding: string;
  textAuthority: WorkspaceTextAuthorityOpened;
  editorProjection: EditorState;
  materializationState: WorkspaceWorldlineMaterializationKind;
  sourceHighlight?: SourceHighlightReading;
  graftInfo?: GraftInfo;
  graftSelectedIndex: number;
  lastActivatedAt: number;
}

interface WorkspaceModel {
  buffers: WorkspaceBufferRegistry;
  activeBufferId?: string;
  editor?: EditorState;
  textAuthority: WorkspaceTextAuthority;
}
```

The transitional `editor` and `textAuthority` fields remain the active view
for existing renderer, save, command, and footer paths. The registry records
the inactive buffers so opening an existing path can reactivate state without
issuing another Echo open.

## Implemented Slice

The first runtime slice intentionally stays narrow:

- Active opened buffers sync into `WorkspaceBufferRegistry`.
- Opening a path that already has a buffer record reactivates it.
- Opening another path stashes the current active buffer first.
- Dirty existing-file buffers survive switching away and back.
- Missing-path unmaterialized buffers survive switching away and back.
- `:edit` for the active path reuses the buffer record instead of reopening.
- Accepted Graft and source-highlight projection state is restored per buffer.
- In-flight Graft/source-highlight loading is invalidated on activation.

This slice does not add multiple panes. The active editor remains visually the
same surface.

## Preservation Contract

Switching files must not be a save/discard decision. If the active buffer has
local session work, the workspace stores its editor projection, text authority,
materialization posture, and accepted enrichment projections before activating
another path.

Reactivation restores:

- active `editor` projection;
- active `textAuthority`;
- `sourceHighlight` if it belongs to that path;
- `graftInfo` if it belongs to that path;
- `graftSelectedIndex`.

Reactivation invalidates:

- source-highlight loading;
- Graft loading;
- stale in-flight request ownership.

The invalidation is deliberate. Request IDs are still global in the
transitional app model. Preserving old loading flags would let inactive
requests claim an active buffer after a switch.

## Future Slices

The registry is not yet complete. Future cycles should add:

- restart recovery UI for inactive unmaterialized buffers;
- explicit path-binding records separate from `pathBinding: string`;
- per-buffer source-highlight and Graft request identity;
- inactive-buffer history drawer filters;
- conflict and external-frontier posture per buffer;
- multi-pane lenses over the same buffer registry;
- agent proposal strands as isolated buffer records;
- buffer close/abandon UI.

## Non-Goals

- No multi-pane UI in this slice.
- No file watcher or external move detection.
- No complete restart recovery workflow.
- No agent-vs-human attribution model.
- No braid UI.
- No durable Echo API change beyond existing text authority use.
