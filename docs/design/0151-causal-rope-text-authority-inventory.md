# Causal Rope Text Authority Inventory

Status: active CR-00 inventory for
[#216](https://github.com/flyingrobots/jedit/issues/216).

This document names every current product path that can create, read, mutate,
save, export, or explain buffer text while Jim is cutting over to causal rope.
It separates authority from projection so the full-snapshot fixture cannot hide
behind app-facing ports.

## Authority Rule

The target authority path is:

```text
workspace command
-> ProductionTextSession
-> TextBufferSessionPort
-> TextBufferOptic
-> installed jedit contract transport
-> graph-backed causal rope authority
```

Full materialized strings are allowed only as import inputs, export outputs,
render windows, tests, or caches. They are forbidden as product text authority.

## Classifications

- **causal rope authority**: authoritative graph-backed rope facts or the
  product seam that must become graph-backed.
- **materialized projection**: text read from a named basis for display,
  export, highlighting, or temporary cache use.
- **fixture**: test-only full-snapshot authority.
- **migration/import**: code that converts host bytes into initial authority
  or adapts old evidence during cutover.
- **forbidden**: a product path that would make full materialized text the
  authority again.

## Inventory

| Area | Path | Current classification | CR target | Follow-up |
| --- | --- | --- | --- | --- |
| Installed transport | `src/adapters/installed-jedit-contract-echo-transport.ts` | migration/import | Construct graph-backed causal rope authority by default; reject fixture authority. | [#218](https://github.com/flyingrobots/jedit/issues/218), [#222](https://github.com/flyingrobots/jedit/issues/222) |
| Runtime profile | `src/adapters/text-runtime-profile-session.ts` | migration/import | Keep `echoHosted` as the product runtime profile and remove the fixture escape hatch after graph rope installs. | [#218](https://github.com/flyingrobots/jedit/issues/218), [#250](https://github.com/flyingrobots/jedit/issues/250) |
| Product session | `src/app/workspace/production-text-session.ts` | materialized projection | Create, edit, read, save, export, and explain through `TextBufferSessionPort`; export remains a projection. | [#224](https://github.com/flyingrobots/jedit/issues/224), [#225](https://github.com/flyingrobots/jedit/issues/225), [#226](https://github.com/flyingrobots/jedit/issues/226) |
| Open/import | `src/app/workspace/workspace-text-open-basis.ts` and `src/app/workspace/workspace-text-commands.ts` | migration/import | Treat host file bytes as import material for `BufferWorldline` and initial `RopeHead`. | [#223](https://github.com/flyingrobots/jedit/issues/223) |
| Workspace authority state | `src/app/workspace/workspace-text-authority.ts` | causal rope authority | Track buffer id, dirty posture, receipts, checkpoints, and projections without storing authority text. | [#231](https://github.com/flyingrobots/jedit/issues/231), [#232](https://github.com/flyingrobots/jedit/issues/232) |
| Command handlers | `src/app/workspace/workspace-text-commands.ts` and `src/app/workspace/workspace-text-edit-planner.ts` | causal rope authority | Convert UI edits to `replaceRangeAsTick` requests and keep predictions separate from admitted text. | [#224](https://github.com/flyingrobots/jedit/issues/224) |
| Operation sequencing | `src/app/workspace/workspace-text-operation-sequencer.ts` | causal rope authority | Preserve admission order for edit, checkpoint, and export operations. | [#231](https://github.com/flyingrobots/jedit/issues/231) |
| Save/export | `src/app/workspace/workspace-save-key.ts` and `src/app/workspace/workspace-text-commands.ts` | materialized projection | Save/export from the current `RopeHead`, then record anchor/checkpoint evidence without mutating text authority. | [#226](https://github.com/flyingrobots/jedit/issues/226), [#233](https://github.com/flyingrobots/jedit/issues/233) |
| Source rendering | `src/app/workspace/viewer-content.ts` and `src/ui/source-viewer.ts` | materialized projection | Render only from basis-tagged text windows and cached projections. | [#225](https://github.com/flyingrobots/jedit/issues/225), [#228](https://github.com/flyingrobots/jedit/issues/228) |
| Reading cache | `src/app/workspace/workspace-text-reading-cache.ts` | materialized projection | Cache projected windows with explicit coverage and basis; never make cache entries authority. | [#230](https://github.com/flyingrobots/jedit/issues/230) |
| Cursor and coordinates | `src/app/workspace/workspace-text-position.ts` | materialized projection | Convert UI cursor/line positions to authoritative UTF-8 byte ranges through typed adapters. | [#227](https://github.com/flyingrobots/jedit/issues/227) |
| Why command | `src/app/workspace/workspace-why-range.ts` and `src/app/jedit-why-range.ts` | materialized projection | Explain ranges from rope head, leaf, blob, rewrite, diff, tick, checkpoint, and anchor evidence. | [#209](https://github.com/flyingrobots/jedit/issues/209), [#239](https://github.com/flyingrobots/jedit/issues/239) |
| Gutter markers | `src/ui/source-viewer.ts` | materialized projection | Compute modified and deleted markers from rope rewrite/diff ancestry. | [#84](https://github.com/flyingrobots/jedit/issues/84), [#235](https://github.com/flyingrobots/jedit/issues/235), [#236](https://github.com/flyingrobots/jedit/issues/236) |
| Footer posture | `src/app/workspace/workspace-footer-posture.ts` | materialized projection | Display durability ladder facts derived from pending intents, admitted heads, save anchors, and Git state. | [#233](https://github.com/flyingrobots/jedit/issues/233), [#234](https://github.com/flyingrobots/jedit/issues/234) |
| Contract runtime | `src/app/jedit-contract-runtime.ts` | migration/import | Replace `HotTextRuntimePort` full-root semantics with graph rope create/read/replace/checkpoint authority. | [#206](https://github.com/flyingrobots/jedit/issues/206), [#222](https://github.com/flyingrobots/jedit/issues/222) |
| Contract observers | `src/app/jedit-contract-query-observers.ts` and `src/app/jedit-observer-runtime.ts` | materialized projection | Query `textWindow` and `worldlineSnapshot` from causal rope basis evidence. | [#225](https://github.com/flyingrobots/jedit/issues/225), [#228](https://github.com/flyingrobots/jedit/issues/228) |
| Graph rope runtime | `src/domain/graph-rope-runtime.ts` and `src/domain/graph-rope-*` | causal rope authority | Become the only installed text authority. | [#222](https://github.com/flyingrobots/jedit/issues/222) |
| Full-snapshot fixture | `src/adapters/full-snapshot-hot-text-runtime-fixture.ts` | fixture | Stay test-only, then move under an explicit test fixture namespace. | [#217](https://github.com/flyingrobots/jedit/issues/217), [#248](https://github.com/flyingrobots/jedit/issues/248) |
| Fake transport | `src/adapters/fake-echo-jedit-optic-transport.ts` | fixture | Remain non-production or accept an explicit fixture injection only. | [#217](https://github.com/flyingrobots/jedit/issues/217), [#247](https://github.com/flyingrobots/jedit/issues/247) |
| Hot buffer helpers | `src/app/hot-buffer-session.ts` and `src/ports/hot-text-runtime.ts` | fixture | Remove from product authority paths after graph rope installation. | [#247](https://github.com/flyingrobots/jedit/issues/247), [#249](https://github.com/flyingrobots/jedit/issues/249) |
| Tests and witnesses | `spec/**` and `tests/**` | fixture | May use the fixture explicitly, but must not mask product imports or clean-build failures. | [#217](https://github.com/flyingrobots/jedit/issues/217), [#249](https://github.com/flyingrobots/jedit/issues/249) |

## Forbidden Product Patterns

These patterns are forbidden in installed product code:

- constructing `FullSnapshotHotTextRuntimeFixture`;
- importing `full-snapshot-hot-text-runtime-fixture`;
- importing stale `in-memory-hot-text-runtime` aliases;
- reading current buffer text from `HotTextBufferState.roots`;
- treating `materializeHotBuffer(...)` or a full text window cache as authority;
- saving from an editor line array instead of a causal basis export;
- computing modified lines from Git diff.

## Open Blockers

- [#217](https://github.com/flyingrobots/jedit/issues/217): add the
  automated product fixture import ban.
- [#218](https://github.com/flyingrobots/jedit/issues/218): make installed
  construction fail unless graph rope authority is supplied.
- [#222](https://github.com/flyingrobots/jedit/issues/222): install graph
  rope runtime as Jim default text authority.
- [#247](https://github.com/flyingrobots/jedit/issues/247): delete or
  quarantine full-root authority.
- [#249](https://github.com/flyingrobots/jedit/issues/249): remove stale
  in-memory runtime aliases and generated import paths.

## Exit Criteria For CR-00

- This inventory covers open/import, workspace state, command handlers,
  save/export, source rendering, `:why`, installed transports, and tests.
- The full-snapshot fixture is explicitly classified as fixture-only.
- Product code has an automated import ban for fixture authority.
- Installed construction fails when no graph-backed authority is supplied.
