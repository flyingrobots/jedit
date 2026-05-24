<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# jedit Echo Real App Proof PR Notes

Status: completed local PR package for slices 91-100. Slices 101-110 are
tracked in
[`0032-jedit-echo-reading-cache-and-fallback-boundaries.md`](0032-jedit-echo-reading-cache-and-fallback-boundaries.md).

## Scope

This package proves the jedit interactive workspace calls the jedit-owned
production text session through the real workspace runtime path. It does not
implement WSC durability, historical export, or full multi-buffer recovery.

## Closed Slices

- Slice 91: canonical gate name is `release-gate:jedit-echo`; the older
  `release-gate:echo` script is a compatibility alias.
- Slice 92: the real app harness drives the same workspace runtime update path
  used by the app.
- Slice 93: file open imports host bytes into the production text session and
  renders the returned bounded reading.
- Slice 94: insert/delete/backspace proof goes through production session edit
  commands.
- Slice 95: save exports materialized production text and checkpoints through
  the session.
- Slice 96: open/edit/read/export/checkpoint obstruction posture is explicit
  and does not retry automatically.
- Slice 97: agent-facing workspace witness reports open, edit, read, export,
  and checkpoint evidence without lifecycle authority.
- Slice 98: UI lifecycle authority is statically guarded.
- Slice 99: direct text authority is inventoried and scoped below.

## Legacy Text Authority Inventory

| Path | Current disposition |
| --- | --- |
| `src/app/workspace/editor-session.ts` | Legacy editor import/export helpers remain adapter-private and test-local support. |
| `src/app/workspace/editor-editing.ts` | Local editing helpers remain render/navigation mechanics and fixture support. |
| `src/app/workspace/editor-editing-helpers.ts` | Local editing implementation remains non-production authority. |
| `src/app/workspace/viewer-key.ts` | Production mutation keys submit session commands; remaining editor helpers are navigation/cache mechanics. |
| `src/app/workspace/viewer-content.ts` | Production rendering reads from the reading cache. |
| `src/app/workspace/workspace-save-key.ts` | Production save exports/checkpoints through the session; legacy save is only for non-opened/test-local authority. |

No listed path may become production text authority without a new slice and an
executable witness.

## Required Local Witnesses

```bash
npm run build
node --test --test-concurrency=1 \
  spec/release-gate-script.spec.mjs \
  spec/workspace-app-echo-cutover.spec.mjs \
  spec/workspace-echo-witness-cli.spec.mjs \
  spec/production-cutover-guard.spec.mjs
npm run release-gate:jedit-echo
npm run quality
git diff --check
```
