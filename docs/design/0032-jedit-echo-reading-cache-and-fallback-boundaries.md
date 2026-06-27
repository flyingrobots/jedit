<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# jedit Echo Reading Cache And Fallback Boundaries

Status: local slice package for slices 101-110.

## Scope

This package closes the ambiguity between production text authority and
workspace display material before WSC durability work begins. It does not add a
new Echo feature. It keeps the editor, text, buffer, cursor, selection, preview,
highlight, and save semantics inside jedit-owned modules and ports.

## Closed Slices

- Slice 101: display-line terminology now flows through a reading-cache
  boundary instead of implying that local lines are production authority.
- Slice 102: reading-cache posture and materialization live in
  `workspace-text-reading-cache.ts`.
- Slice 103: cursor and selection-to-byte range conversion lives in
  `workspace-text-edit-planner.ts`.
- Slice 104: replace command execution goes through `replaceRange` on the
  production text session and refreshes bounded reading material.
- Slice 105: production undo and redo return explicit unsupported posture until
  they are modeled as causal input.
- Slice 106: workspace footer state can render concise text posture without
  exposing Echo lifecycle authority.
- Slice 107: source highlighting consumes refreshed reading material.
- Slice 108: preview rendering consumes reading material instead of stale local
  lines.
- Slice 109: the current policy is explicit single-active-buffer authority;
  save targets the active production buffer only.
- Slice 110: non-Echo profile input is rejected; focused fake-port tests remain
  fixture scaffolding without becoming a production runtime mode.

## Doctrine

In production, Echo/session authority owns causal text. `EditorState.lines` is
the full local visible projection cache used for rendering, cursoring, and
transitional edit planning. It must not be reconstructed from bounded readings.
It is not saved or recovered as authority. The production authority path is:

```text
jedit UI command
-> jedit planner or workspace command
-> TextBufferSessionPort
-> Echo-hosted jedit contract state
-> bounded reading cache
-> render, preview, highlight
-> full export snapshot
-> save/export materialization
```

Echo remains generic. It does not own text, editor, buffer, cursor, file,
selection, preview, highlight, or save semantics.

## Projection Coverage

The production path names coverage explicitly because these terms are not
interchangeable:

- **Full projection**: a complete selected text frontier that covers the whole
  document. It may replace `editor.lines` when the coverage predicate proves
  the reading is full.
- **Window projection**: an Echo text-window observation with `startLine`,
  returned line count, total line count, before/after flags, and truncation
  posture. It may update cache, history, diagnostics, and status. It may not
  replace the whole editor.
- **Viewport rendering slice**: the bounded source or preview rows painted into
  the current terminal rectangle. It is paint material only.
- **Export snapshot**: a full selected frontier materialization payload used by
  save/export. It is not a viewport window and not `WorkspaceTextReadingCache`
  lines by convention.
- **Recovery evidence**: retained operation, observation, replay, or snapshot
  evidence. It is materializable only when it proves full coverage or a
  replayable chain from a known full basis.

## Forbidden Patterns

These patterns are architecture bugs:

- `editor.lines = cache.lines` when cache coverage is `window`;
- `saveEditorFile(cache.lines)`;
- WSC recovery or materialization from a truncated/window reading;
- default top-of-file aperture for current cursor or edit follow-up refresh;
- Graft drawer rows that use stale or saved-only data without visible posture.

## WSC Reading Evidence

WSC retained readings are evidence. They are not automatically recovery
material and they are not automatically host materialization payloads.

A retained text edit envelope may carry:

- operation evidence, such as the edit range, receipt, file path, and submitted
  time;
- observation evidence, such as a bounded reading window and its coverage
  metadata;
- replay or export evidence, if a later cycle proves a full projection or a
  replayable operation chain from a known full basis.

A bounded reading is not a document. A current-history export, recovered
materialization, or restart recovery path must fail closed unless it has either
a full-document projection or a replayable causal operation chain from a known
full basis. Window-only evidence remains useful for history and debugging, but
it must not be presented as recovered full text and must not be written to disk.

## Text Windows And Export Snapshots

`textWindow` is a bounded observation operation. It is for rendering,
navigation, projection evidence, and diagnostics. The app may request different
apertures as the cursor or viewport moves, but the returned lines remain window
evidence unless the reading explicitly covers the whole document.

Save and host export use a separate app-level operation: `exportSnapshot`.
Today that operation is a transitional wrapper over the existing text-window
read path. The wrapper must prove full coverage before it returns text:

- `startLine` is zero;
- no earlier or later lines exist;
- the reading is not truncated;
- returned line count equals total line count;
- returned line entries cover the total line count.

If those facts are not present, export is obstructed before host preflight,
`saveEditorFile`, checkpointing, or clean/materialized authority updates. A
future Echo API can replace the transitional wrapper with a native full
frontier snapshot or replay-backed materialization operation, but the product
boundary remains the same: a text window is not an export.

## Local Witnesses

```bash
npm run build && npm run quality
node --test \
  spec/workspace-text-boundaries.spec.mjs \
  spec/workspace-app-echo-cutover.spec.mjs \
  spec/workspace-echo-witness-cli.spec.mjs \
  spec/production-cutover-guard.spec.mjs \
  spec/release-gate-script.spec.mjs
npm run release-gate:jedit-echo
git diff --check
```
