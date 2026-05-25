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
- Slice 110: test-local fallback remains explicit fixture behavior and invalid
  profile input falls back to Echo-hosted production behavior.

## Doctrine

`EditorState.lines` remains a render and navigation cache. It is not production
text authority. The production authority path is:

```text
jedit UI command
-> jedit planner or workspace command
-> TextBufferSessionPort
-> Echo-hosted jedit contract state
-> bounded reading cache
-> render, preview, highlight, save/export materialization
```

Echo remains generic. It does not own text, editor, buffer, cursor, file,
selection, preview, highlight, or save semantics.

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
