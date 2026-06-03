# Code Standards Audit

Date: 2026-05-13

This audit records the gap between the current executable quality ratchet and
the full project standard in `CODE_STANDARDS.md`. It is intentionally a planning
artifact: no runtime behavior is changed here.

## Inputs

- Repository head: `e501ea9` (`main`, after PR #16)
- Enforced gate: `npm run quality -- --json`
- Additional measurement: TypeScript AST scan over `src/**/*.ts`
- Scope: hand-authored and generated TypeScript under `src`

## Executive Summary

The enforceable ratchet is clean:

| Rule | Status | Evidence |
| :--- | :--- | :--- |
| No `any` | Clean | quality gate reports `0` regressions |
| No `unknown` | Clean | quality gate reports `0` regressions |
| Max 500 lines per TypeScript file | Clean | quality gate reports `0` regressions |

The broader standard is not yet fully enforced. The largest gaps are function
size, cyclomatic complexity, import fan-in, parameter count, and the project-wide
ban on type assertions. These should be treated as tracked debt, not permission
to add more.

## Metric Snapshot

| Metric | Current |
| :--- | ---: |
| TypeScript files scanned | 105 |
| Total TypeScript lines scanned | 15,822 |
| Files at or above 425 lines | 7 |
| Files over 500 lines | 0 |
| Files over 12 imports | 8 |
| Functions over 35 lines | 38 |
| Functions over nesting depth 4 | 1 |
| Functions over complexity 8 | 32 |
| Functions over 5 parameters | 9 |
| Classes over 400 lines | 0 |
| Classes over 15 public methods | 0 |
| Type assertions, including `as const` | 84 |
| `enum` declarations | 0 |
| `throw new Error(...)` in `src` | 0 |
| Direct host API touches measured | 8 |

The AST scan is conservative and should be converted into an executable ratchet
before these counts are used as hard CI policy. It is good enough to identify
the first cleanup sequence.

## Near File-Size Limit

These files are compliant today but close enough to the 500-line limit that new
work should avoid growing them:

| File | Lines |
| :--- | ---: |
| `src/adapters/jedit-echo-optic-codec.ts` | 500 |
| `src/ui/title-scene.ts` | 496 |
| `src/app/jedit-contract-runtime.ts` | 495 |
| `src/app/workspace/editor-editing-helpers.ts` | 476 |
| `src/ui/title-screen.ts` | 449 |
| `src/ui/theme-builder.ts` | 428 |

Priority: prevent growth immediately, then split when touching these areas.

## Import Fan-In

`CODE_STANDARDS.md` sets a maximum of 12 imports per file. Current offenders:

| File | Imports |
| :--- | ---: |
| `src/app/workspace/key-bindings.ts` | 30 |
| `src/app/workspace/viewer.ts` | 25 |
| `src/adapters/workspace-app.ts` | 23 |
| `src/app/workspace/runtime.ts` | 23 |
| `src/app/workspace/file-tree.ts` | 17 |
| `src/app/workspace/model.ts` | 16 |
| `src/app/workspace/editor-session.ts` | 14 |
| `src/app/workspace/init.ts` | 13 |

Primary concern: workspace orchestration modules still aggregate too many
responsibilities. This is a better refactor target than mechanical import
rewriting.

## Function Size and Complexity

Largest functions over the current standard:

| Function | Location | Lines | Params | Depth | Complexity |
| :--- | :--- | ---: | ---: | ---: | ---: |
| `updateFromKey` | `src/app/workspace/key-bindings.ts:99` | 185 | 6 | 5 | 56 |
| anonymous update body | `src/app/workspace/runtime.ts:64` | 144 | 1 | 2 | 21 |
| anonymous reducer body | `src/app/workspace/runtime.ts:83` | 122 | 2 | 2 | 20 |
| `renderWorkspace` | `src/app/workspace/viewer.ts:88` | 106 | 1 | 1 | 11 |
| `createEchoTransportJeditOpticClient` | `src/adapters/jedit-echo-optic-client.ts:71` | 94 | 1 | 1 | 9 |
| `previewMarkdownLines` | `src/ui/markdown-preview.ts:30` | 90 | 1 | 2 | 16 |
| `updateGraftDrawerFromKey` | `src/app/workspace/graft-drawer.ts:17` | 87 | 3 | 2 | 19 |
| `updateTreeFromKey` | `src/app/workspace/file-tree.ts:34` | 66 | 4 | 2 | 10 |
| `sceneSampleAt` | `src/ui/title-screen.ts:168` | 63 | 10 | 2 | 7 |
| `updateInsertMode` | `src/app/workspace/editor-editing.ts:165` | 62 | 5 | 1 | 17 |

The first cleanup target should be `updateFromKey`: it violates line count,
parameter count, nesting depth, and complexity in one place.

## Type Assertions

The AST scan found 84 type assertions in `src`, including many `as const`
token declarations and generated-code constants.

Recommended classification:

| Bucket | Policy |
| :--- | :--- |
| Generated files under `src/generated` | Track separately; do not hand-edit generated output. |
| Boundary casts in adapters | Replace with parser/constructor validation where practical. |
| `as const` runtime token tables | Convert to explicit runtime objects, classes, or `Object.freeze` values with named types when touched. |
| Generic model casts in app helpers | Replace with narrower model interfaces or returned concrete model types. |

High-signal source files to inspect first:

- `src/app/source-highlight-session.ts`
- `src/adapters/echo-wasm-kernel.ts`
- `src/adapters/title-scene-loader.ts`
- `src/adapters/title-bunny-mesh.ts`
- `src/app/jedit-observer-spec.ts`
- `src/app/workspace/editor/key.ts`
- `src/app/workspace/workspace-key.ts`
- `src/ui/jedit-theme.ts`

## Host API Touches

Measured direct host APIs:

| API | Location | Initial classification |
| :--- | :--- | :--- |
| `Date.now` | `src/adapters/workspace-app.ts:45` | Adapter injection default, acceptable. |
| `Math.random` | `src/adapters/workspace-app.ts:46` | Adapter injection default, acceptable. |
| `process.env` | `src/adapters/workspace-app.ts:90` | Adapter boundary, should be injected/configured later. |
| `process.cwd` | `src/main.ts:8` | Process entry point, acceptable. |
| `process.env` | `src/main.ts:27` | Process entry point, acceptable. |
| `Date.now` | `src/ui/feedback.ts:75` | UI helper fallback; should be made explicit through caller/capability. |

The likely fixes are small: remove default `Date.now` from app logic and keep
host capabilities in adapters or process entry points.

## Architecture Observations

- The `src/main.ts` split is successful; the process entry point is now small.
- Workspace input, runtime update, and rendering remain orchestration hot spots.
- Title rendering is close to size limits and has several high-parameter helper
  functions. Any TUI/title visual work should include local decomposition.
- Codec and contract runtime files are still near the file-size ceiling; future
  contract work should prefer new focused modules over adding to these files.
- Generated files need an explicit policy before broad type-assertion rules are
  enforced against them.

## Remediation Backlog

### Must Fix Before New Feature Work

1. Split `src/app/workspace/key-bindings.ts`.
   - Extract scene picker handling.
   - Extract title screen key handling.
   - Extract editor command dispatch.
   - Replace the six-parameter `updateFromKey` with a named context object or
     injected command environment.

2. Split workspace runtime dispatch.
   - Replace anonymous 100+ line update bodies with named message handlers.
   - Keep `WorkspaceMessageTypes` as the central runtime truth.

3. Add a second quality ratchet script or extend `scripts/quality-gate.mjs`.
   - Start with reporting-only JSON for function length, params, imports,
     complexity, and assertions.
   - Only fail CI once baselines are explicit and shrinking.

### Should Fix Before TUI Landing Work

1. Port only the small `tui` commits first.
   - `dbdc946` floor fade hit fix.
   - `821d24d` ASCII inactive color fix.
   - `b12cffe` help copy scope fix.

2. Keep `/Users/james/git/jedit-rays` read-only during the port.
   - The worktree has an untracked `docs/data-model.md` and an old branch shape.
   - Replaying selected commits onto fresh `main` is safer than merging `tui`.

3. Treat the Flying Robots logo work as a separate visual PR.
   - It adds a Braille text asset and a new renderer module.
   - It should include screenshot or surface-level verification.

4. Re-design the Think-style notice change against current `src/ui/feedback.ts`.
   - Do not cherry-pick `9d94a30` directly.
   - It predates the current notification-token and runtime-issue toast work.

### Ratchet Later

1. Type assertion policy by bucket.
2. Import count enforcement.
3. Function length and parameter count enforcement.
4. Complexity enforcement.
5. Host API placement enforcement.

## Proposed PR Sequence

1. `chore(quality): add code standards audit`
   - Adds this audit only.

2. `refactor(workspace): split key binding dispatch`
   - High value because it removes the single worst standards violation.

3. `refactor(workspace): split runtime message handlers`
   - Reduces long anonymous functions and import fan-in.

4. `chore(quality): report extended standards metrics`
   - Adds reporting-only metrics for currently unenforced rules.

5. `fix(title): port low-risk tui rendering fixes`
   - Replays the three small `tui` fixes onto current `main`.

6. `feat(title): port Flying Robots logo band`
   - Separate visual PR with focused verification.

## Decision Record

Do not start new feature work until the audit is merged and the first workspace
dispatch cleanup is either complete or explicitly deferred. The repository is
green, but the standards gap is real enough that new feature work should not
increase the current hot spots.
