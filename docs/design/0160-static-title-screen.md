---
title: "DX-0160 - Static title screen only"
legend: "DX"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/338"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-10-14"
updated: "2026-10-14"
---

# DX-0160 - Static title screen only

## Linked Issue

- https://github.com/flyingrobots/jedit/issues/338

## Decision Summary

Remove the ray tracer from the live title-screen integration. The static Jim
logo is the only no-buffer workspace body. Former camera, shader, material,
mouse-look, and scene-picker actions cannot switch it to an animated scene.
Standalone preview, profile, and recording tools retain their existing engine.

## Sponsored Human

A keyboard user wants to use the title screen without accidentally activating
ray tracing by pressing Space or moving the pointer.

## Sponsored Agent

An agent needs a production module graph and runtime witnesses proving that
ray tracing is unreachable from the workspace.

## Hill

Former title-scene input leaves the static logo intact, schedules no scene
work, and does not create camera state or reenable idle animation.

## Current Truth

Space is interpreted as camera jump, and any camera update selects the legacy
ray-traced backdrop. Ctrl+L, shader keys, and mouse look can also activate it.
The renderer accepts legacy scene state and injected ray-tracer renderers.
See [title-screen-key-bindings.ts#154:ecefbbb695ddeedaed94e0046c580e2041cca40f](https://github.com/flyingrobots/jedit/blob/ecefbbb695ddeedaed94e0046c580e2041cca40f/src/app/workspace/title-screen-key-bindings.ts#L154)
and [viewer-content.ts#135:ecefbbb695ddeedaed94e0046c580e2041cca40f](https://github.com/flyingrobots/jedit/blob/ecefbbb695ddeedaed94e0046c580e2041cca40f/src/app/workspace/viewer-content.ts#L135).

## Problem

Ordinary input can unexpectedly replace the static logo and start ray tracing.
Changing one shortcut leaves other activation paths reachable.

## Scope

- Remove live ray-tracer rendering, caches, controls, scene picker, and title-only stats.
- Remove scene/camera state, messages, loader composition, and advertised bindings.
- Preserve the static logo, file browsing, Settings, editor, quit flow, and generic instrumentation.

## Non-Goals

- Delete or redesign the standalone engine, scene assets, preview/profile/record tools.
- Change text authority, Leader settings, or implement leader dispatch.

## User Experience / Product Shape

The no-buffer view always shows the existing static Jim logo. Space, WASD,
arrow-camera controls, number/shader keys, material keys, and mouse movement
perform no title-scene action. Ctrl+L no longer opens a scene picker. Existing
file, Settings, command-line, and quit actions retain their focus ownership.
Help and footer stop advertising scene selection. There is no new layout,
transition, input capture, or persistent preference.

### User Journey

Start Jim → see static logo → open Settings or a file, or quit. Former scene
input cannot change that view. Closing the last buffer returns to the logo.

### Wide UI Mockup

Retain the existing logo at 100×32; no visual redesign. The footer lists only
currently available workspace actions. Actual rendered output is verified.

### Narrow UI Mockup

Retain the existing logo and drawer behavior at 60×16. Below the existing
60×12 minimum, the small-terminal notice retains precedence.

### Accessibility Considerations

Remove obsolete help. Existing text labels, theme, keyboard navigation,
Settings, file-drawer focus, and quit confirmation remain available.

## Runtime / API Contract

The viewer no longer accepts or invokes a ray-tracer renderer. Workspace
initialization no longer builds scene/camera state. The runtime no longer
accepts scene-load results or camera animation messages. A stale external scene
message cannot mutate the workspace. Title Escape still opens quit confirmation.
Standalone renderer APIs remain separate from production workspace composition.

## Lower Modes

The static logo and ordinary help remain available in pipe/no-color rendering.
Small-terminal notice behavior remains unchanged. No optional scene loader,
mesh, camera, or ray tracer is required for startup or title input.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | Existing static artwork and workspace/editor state. |
| Derived state | Logo surface sized to the viewer viewport. |
| Removed state | Scene, meshes, camera, material/shader selection, scene-picker focus, and tracing caches. |
| Reset behavior | Return to the logo when no buffer is displayed. |
| Persistence | No configuration or Echo contract changes. |

## Accessibility Posture

No new interaction or color-only state. Escape, Settings, and file browsing
remain keyboard reachable. Mouse movement is inert on the logo.

## Localization / Directionality Posture

Remove obsolete scene-picker hints from help, footer, and catalogs. Retain
existing localized labels and LTR/RTL logo presentation. Regenerate catalogs.

## Agent Inspectability / Explainability Posture

Runtime tests compare rendered surfaces and emitted commands. A production
module-loading witness verifies that no ray-tracer renderer or scene loader is
reachable through the live workspace dependency graph.

## Linked Invariants

- Tests exercise runtime and rendered output, not design-document assertions.
- Preserve editor behavior and the Echo authority boundary.
- Use the existing `title-unfreeze` label under the
  [freeze policy](../method/backlog/leash/title-scene-freeze.md). The human's
  explicit removal request authorizes this narrow title integration change;
  engine/asset polish remains frozen.

## Design Alternatives Considered

Only removing Space leaves mouse look, shader controls, and scene selection
reachable. Hiding the scene UI retains dormant production tracing and state.
Deleting the standalone engine expands the request beyond the live title screen.

## Decision

Remove the complete live integration and retain the isolated standalone tools.

## Implementation Slices

- [x] Slice 1: Remove live rendering and title-scene input paths.
- [x] Slice 2: Remove scene state/dependencies/help and verify preserved workspace flows.

## Tests To Write First

- [x] Former keyboard and mouse controls leave the logo unchanged and emit no scene work.
- [x] Startup and stale scene/camera messages cannot create ray-tracer state.
- [x] Logo remains idle and renders even when legacy properties are supplied.
- [x] Settings, file drawer, quit, minimum geometry, and standalone tools retain behavior.

## Acceptance Criteria

- [x] All live title ray-tracer paths are removed.
- [x] Real runtime/render/module-graph witnesses pass.
- [x] Obsolete integration tests are replaced by static-title regressions.
- [x] Full repository validation passes and CI is reported at the published head.

## Validation Plan

```bash
npm run check
npm run ci:verify-shards
```

## Playback / Witness

Run Jim at 100×32 and 60×16. Press Space, WASD, 1, 2, period, M, Ctrl+L,
and move the pointer. The logo remains. F2 opens Settings; Ctrl+B opens Files;
Escape opens quit confirmation. After startup completion, an idle time tick
retains the same model reference.

## Risks

The legacy title spec mixes removed scene behavior with current file-drawer
behavior. Remove only obsolete assertions and keep the live file/Settings/quit
witnesses. Standalone tools share the engine; do not delete their dependencies.

## Follow-On Debt

None introduced. Reintroducing a title ray tracer would require a separate
explicit product decision and new runtime integration.

## Retrospective

The live integration is removed, including title camera/shader/material input,
mouse look, scene picker, scene/camera state and messages, scene-loader
composition, renderer injection, caches/governor, and title-scene stats. The
static logo is the only no-buffer body. The standalone engine, assets, and
preview/profile/record tools are unchanged.

Five of the six new runtime/render/module-loading witnesses failed before
removal; the preserved workspace-action witness also passed on the baseline.
All six passed afterward. They cover former inputs, pointer movement, stale messages,
legacy property injection, preserved Settings/Files/quit actions, and the
production dependency graph. The real graph no longer loads `ui/title-screen`,
`ui/title-scene`, `app/title-camera-session`, or `adapters/title-scene-loader`.
Obsolete integration tests were retired; current workspace-flow and standalone
engine/tool tests remain. Unused old title-test helpers were removed.

`npm run check` passed: 830 JavaScript tests passed, 12 existing skips, 99 native
Rust tests passed, and no quality regressions. The final focused title tests
passed 25/25 after removing unused helpers. Test-shard coverage passed with
130 spec files. The test-file size ratchet was lowered to the new bounds for
workspace command-line, runtime, and title-screen specs.

Live PTY verification used the real native Echo host with an isolated WAL at
100×32 and 60×16. At each size, 17 former keyboard/mouse activation events
produced one unchanged rendered-cell digest, zero commands, and no scene or
camera properties. At 100×32 F2 opened/closed Settings and Ctrl+B opened Files.
At 60×16 Escape opened quit confirmation, and confirmation exited cleanly.
Rendered static-logo cells were visually inspected. No text mutation was needed
for this presentation change, and no Echo API or authority boundary changed.

PR: https://github.com/flyingrobots/jedit/pull/339

No follow-on work is required for the removal. The separate Leader-settings
PR #336 and its unresolved configuration-ownership question are unchanged.
