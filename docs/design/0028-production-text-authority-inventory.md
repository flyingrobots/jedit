# Production Text Authority Inventory

Status: active inventory for
[`0027-echo-hosted-production-cutover.md`](0027-echo-hosted-production-cutover.md)
slices 61-80.

This document names the current interactive editor paths that read or write text
state. Its purpose is to prevent the Echo-hosted production cutover from leaving
a hidden second source of truth.

## Authority Rule

Production text authority must converge on this shape:

```text
workspace command
-> jedit-owned text session/controller port
-> TextBufferSessionPort
-> TextBufferOptic
-> jedit contract adapter
-> Echo generic runtime
```

The local editor model may continue to hold cursor, scroll, visual mode,
selection/register, and rendering cache state. It must not remain the
production source of truth for buffer text once the cutover is complete.

Echo remains generic. Echo must not learn text buffers, ropes, cursors, panes,
documents, selections, or file export semantics.

## Direct Text Read/Write Paths

| Path | Current authority | Cutover target |
| --- | --- | --- |
| `src/app/workspace/file-tree.ts` | Opening a file calls `loadEditor(...)`, which reads file content into `EditorState.lines`. | Open through a production text controller that calls `TextBufferSessionPort.createBuffer(...)`. |
| `src/app/workspace/editor-session.ts` | `loadEditor(...)` and `saveEditor(...)` read/write filesystem text directly. | Keep filesystem import/export behind adapters; separate file export from Echo causal mutation. |
| `src/app/workspace/viewer-key.ts` | Insert and normal-mode commands call local mutation helpers over `EditorState.lines`. | Convert editing commands to jedit app intents through `TextBufferOptic.applyIntent(...)`. |
| `src/app/workspace/editor-editing.ts` | Command routing returns locally mutated `EditorState`. | Keep cursor/visual command calculation local, but route text-changing commands through the app intent path. |
| `src/app/workspace/editor-editing-core.ts` | Low-level helpers mutate local line arrays. | Demote to fixture/adapter-local support or pure command-planning helpers once production text authority is Echo-hosted. |
| `src/app/workspace/viewer-content.ts` | Rendering reads `editor.lines` directly. | Render from bounded `TextBufferOptic.textWindow(...)` readings with retained reading identity in UI state. |
| `src/app/workspace/global-key-bindings.ts` | Save calls `saveEditor(...)` over local lines. | Save/export reads a bounded Echo-backed basis and writes a jedit-owned file artifact; checkpoint remains a contract intent. |

## Current Slice Boundary

Slices 61-70 establish the production runtime profile and a production text
session/controller surface. They do not delete every legacy helper in one pass.
The remaining direct imports are tracked here so later slices can quarantine or
remove them without guessing.

## Cutover Invariants

- `echoHosted` is the default production runtime profile.
- `testLocal` is an explicit dev/test fixture profile.
- Opening a production buffer uses `TextBufferSessionPort.createBuffer(...)`.
- Editing a production buffer uses `TextBufferOptic.applyIntent(...)`.
- Rendering a production buffer uses `TextBufferOptic.textWindow(...)`.
- Cursor and viewport state select the jedit query aperture; they are not Echo
  semantics.
- Obstructed work produces explicit runtime issue posture and no hidden retry.
- Export reads from a causal basis and does not mutate Echo state.
