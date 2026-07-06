---
title: "WF-0151 - Edict Projection Lens"
legend: "WF"
lane: "implementation"
issue: "https://github.com/flyingrobots/jedit/issues/256"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-07-05"
updated: "2026-07-05"
---

# WF-0151 - Edict Projection Lens

## Linked Issue

- https://github.com/flyingrobots/jedit/issues/256

## Decision Summary

jedit will consume Graft 0.11.1 and use the Graft/Edict projection provider for
dirty `.edict` editor buffers. The Graft drawer will render bounded Edict Core
and Echo Target IR projection lanes, including projection state and digest
facts, while preserving jedit's boundary as a display surface rather than an
Edict compiler, Echo runtime, or Jim admission authority.

## Sponsored Human

A Jim user wants to edit Edict source and inspect the compiler's Core and Echo
Target IR projections beside the editor so that the source-to-artifact path is
visible before any runtime or admission flow exists, without saving the file
just to refresh the projection.

## Sponsored Agent

An agent needs a typed jedit surface for upstream Edict projection facts so it
can verify source, Core, Target IR, and receipt lanes through stable fields,
without scraping pixels or inferring private Graft or Edict internals.

## Hill

By the end of this cycle, dirty `.edict` buffers can be projected through Graft
0.11.1, the drawer can show Edict Core and Echo Target IR lanes, and focused
adapter plus drawer specs prove the carried facts are decoded and rendered
without jedit interpreting Edict, Echo, or receipt semantics.

## Current Truth

On `origin/main` at
`bf6a98bbf26fdee3571af62ac2bbc82ee764bea4`, `GraftFileRequest`
contains workspace root, file path, and dirty state, but no editor buffer
content:
[`src/ports/graft-session.ts#L50:bf6a98bbf26fdee3571af62ac2bbc82ee764bea4`](https://github.com/flyingrobots/jedit/blob/bf6a98bbf26fdee3571af62ac2bbc82ee764bea4/src/ports/graft-session.ts#L50).

The Graft API adapter currently loads saved-file outlines and labels dirty
files as stale saved-file projections:
[`src/adapters/graft-api-session.ts#L124:bf6a98bbf26fdee3571af62ac2bbc82ee764bea4`](https://github.com/flyingrobots/jedit/blob/bf6a98bbf26fdee3571af62ac2bbc82ee764bea4/src/adapters/graft-api-session.ts#L124).

The Graft drawer already renders an opaque obstruction receipt lane when
upstream metadata supplies one:
[`src/ui/graft-drawer.ts#L105:bf6a98bbf26fdee3571af62ac2bbc82ee764bea4`](https://github.com/flyingrobots/jedit/blob/bf6a98bbf26fdee3571af62ac2bbc82ee764bea4/src/ui/graft-drawer.ts#L105).

The current package dependency is `@flyingrobots/graft` 0.10.1, which predates
the published Edict projection bridge:
[`package.json#L38:bf6a98bbf26fdee3571af62ac2bbc82ee764bea4`](https://github.com/flyingrobots/jedit/blob/bf6a98bbf26fdee3571af62ac2bbc82ee764bea4/package.json#L38).

## Problem

jedit can already show Graft outline and receipt facts, but it still treats
dirty editor buffers as stale saved-file projections. That blocks the intended
Edict authoring loop: write Edict, inspect Core, inspect Echo Target IR, then
later inspect any upstream receipt facts. If jedit keeps using saved-file-only
projection for `.edict`, the editor surface lies about the projection basis.

## Scope

This cycle includes:

- bumping `@flyingrobots/graft` from 0.10.1 to 0.11.1;
- passing dirty `.edict` editor text to the Graft/Edict projection provider;
- adding typed optional Edict Core and Echo Target IR projection lanes to
  `GraftInfo`;
- rendering bounded Core and Target IR rows in the Graft drawer;
- preserving existing outline, diff, Colorful, and obstruction receipt behavior;
- documenting the display-only authority boundary.

## Non-Goals

This cycle does not include:

- Echo execution from jedit;
- Jim admission;
- canonical Echo receipt bytes or receipt digests;
- jedit-side Edict parsing, Core construction, or Target IR lowering;
- jedit interpretation of Edict, Echo, Jim, or obstruction semantics;
- Graft schema freezing beyond consuming the published package API.

## User Experience / Product Shape

The user opens or edits a `.edict` file. When the Graft drawer refreshes, jedit
uses the live buffer text as projection input. If Graft/Edict returns Core or
Target IR facts, the drawer shows compact lanes before the receipt and outline
sections.

### Wide UI Mockup

```text
graft
demo.edict
source: live-buffer
posture: current

edict core
state: available
digest: sha256:1111111111111111111111111111111111111111111111111111111111111111

echo target ir
state: available
domain: echo.span-ir/v1
digest: sha256:2222222222222222222222222222222222222222222222222222222222222222

outline
structural outline unavailable
```

### Narrow UI Mockup

Long digests and review summaries are truncated with the same line-fitting rule
used by the existing drawer. The drawer does not wrap Core, Target IR, or
receipt facts into adjacent panes.

### Accessibility Considerations

The projection lanes use plain text labels and values. The same rows are
available to tests and terminal output, so agents and screen readers can inspect
the facts without color or layout-only cues.

## Runtime / API Contract

`GraftFileRequest` gains optional live source content. The adapter only uses it
for `.edict` projection requests.

`GraftInfo` gains typed optional lanes:

```ts
interface GraftEdictProjectionLane {
  readonly state: string;
  readonly digest?: string;
  readonly summaryLines: readonly string[];
}

interface GraftEchoTargetIrProjectionLane extends GraftEdictProjectionLane {
  readonly domain?: string;
}
```

jedit treats these lanes as display facts from Graft. It does not derive them,
validate their Edict semantics, execute Echo, or admit artifacts.

## Lower Modes

The lower mode is the existing text drawer output. Focused specs assert the
rendered lines directly and the adapter specs assert the decoded `GraftInfo`
shape.

When Graft 0.11.1 or the Edict provider is unavailable, jedit should keep the
existing outline/diff error handling: the drawer shows an error or unavailable
state rather than crashing.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | The current editor buffer for `.edict` projection input; upstream Graft/Edict output for projection facts. |
| Derived state | `GraftInfo` lanes and drawer text rows. |
| Invalid states | jedit computing Core/Target IR itself, treating saved-file projection as current for dirty `.edict`, or interpreting receipt semantics. |
| Reset behavior | Projection lanes disappear when new `GraftInfo` lacks them or the active file changes. |
| Serialization | No new persistence. |
| Deterministic assumptions | Drawer row ordering is fixed and bounded; payload keys remain sorted where existing receipt logic applies. |

## Accessibility Posture

| Concern | Posture |
| --- | --- |
| Semantic labels or facts | Core and Target IR rows have text labels. |
| Focus order or ownership | Drawer navigation remains unchanged. |
| Hidden or visual-only information | Projection state and digests are textual. |
| Keyboard behavior | Existing Graft drawer refresh and navigation keys remain unchanged. |
| Secret or redaction behavior | No new secret material is introduced. |

## Localization / Directionality Posture

| Concern | Posture |
| --- | --- |
| User-visible strings | New drawer labels are English-only like adjacent Graft drawer rows. |
| Catalog keys | No catalog update in this cycle. |
| Supported locales updated | Not applicable; existing drawer is not catalog-backed. |
| Directionality assumptions | Rows remain left-to-right diagnostic facts. |
| Validation command | Focused drawer specs assert text rows. |

## Agent Inspectability / Explainability Posture

Agents can inspect `GraftInfo.edictCoreProjection` and
`GraftInfo.echoTargetIrProjection` directly through the port type, or inspect
the rendered drawer rows in focused specs. The lanes expose carried digest and
domain facts without requiring agents to parse opaque receipt JSON.

## Linked Invariants

- Tests are executable spec.
- Runtime truth beats compile-time theater.
- Encoding and decoding happen at the adapter boundary.
- Graft routes projection authority; jedit displays projection facts.
- Echo authority remains outside jedit product nouns.
- No `any`, no `unknown`, no TypeScript file over 500 LOC.

## Design Alternatives Considered

### Option A: Keep Saved-File Projection Only

Pros:

- Minimal jedit code change.
- Existing outline/diff behavior stays untouched.

Cons:

- Dirty `.edict` buffers still project stale saved-file content.
- The editor cannot support the source-to-Core-to-Target-IR authoring loop.

### Option B: Let jedit Interpret Edict JSONL Directly

Pros:

- Avoids another Graft adapter call.

Cons:

- Violates the Graft projection-broker boundary.
- Makes jedit depend on Edict internals instead of the Graft projection facade.

### Option C: Consume Graft 0.11.1 Projection Lanes

Pros:

- Keeps Graft as projection broker and Edict as compiler authority.
- Lets dirty editor text remain source of truth.
- Preserves jedit as display/composition layer.

Cons:

- Requires package upgrade and adapter decoding work.

## Decision

Choose Option C. jedit will consume the published Graft 0.11.1 package and
decode only the projection facts needed for display. The decision expires when
a future jedit cycle introduces a richer generic projection-lane panel; this
cycle should not build that larger UI.

## Implementation Slices

- [x] Slice 1: Add design packet and issue linkage.
- [x] Slice 2: Bump Graft dependency to 0.11.1 and add adapter RED tests for
      dirty `.edict` projection input and decoded Core/Target IR lanes.
- [x] Slice 3: Implement adapter decoding and live buffer request plumbing.
- [x] Slice 4: Add drawer RED tests for Core/Target IR rows.
- [x] Slice 5: Implement bounded drawer rendering and row accounting.
- [x] Slice 6: Update docs/changelog, fill retrospective, validate, and open PR.

## Tests To Write First

Behavior tests required:

- [x] `spec/graft-api-session.spec.mjs` proves dirty `.edict` content is passed
      to the Graft/Edict projection surface.
- [x] `spec/graft-api-session.spec.mjs` proves Core and Target IR lanes decode
      into `GraftInfo`.
- [x] `spec/workspace-graft-refresh.spec.mjs` proves live editor lines are
      passed into Graft requests.
- [x] `spec/graft-drawer.spec.mjs` proves Core and Target IR rows render.
- [x] `spec/graft-drawer.spec.mjs` proves rows stay bounded and receipt display
      remains opaque.

Documentation and process tests:

- [x] Existing quality and design-cycle checks remain green.

## Acceptance Criteria

The work is done when:

- [x] jedit depends on `@flyingrobots/graft` 0.11.1.
- [x] Dirty `.edict` buffers use live editor content for projection requests.
- [x] Core projection state and digest render in the drawer when available.
- [x] Echo Target IR state, domain, and digest render in the drawer when
      available.
- [x] Existing obstruction receipt rows still render without receipt digests.
- [x] Existing non-Edict outline/diff behavior remains unchanged.
- [ ] Issue #256 and the PR are linked correctly.
- [x] Local validation is green.

## Validation Plan

Commands expected before PR:

```bash
npm run build
JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/graft-api-session.spec.mjs spec/workspace-graft-refresh.spec.mjs spec/graft-drawer.spec.mjs
npm run quality
npm run check
```

## Playback / Witness

Reviewers can inspect the focused specs and run:

```bash
npm run build
JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/graft-api-session.spec.mjs spec/workspace-graft-refresh.spec.mjs spec/graft-drawer.spec.mjs
```

The drawer rows provide the witness surface.

## Risks

Known risks:

- Graft 0.11.1 projection bundle shape may be broader than this display slice
  needs.
- Rendering full review JSON could flood the drawer.
- Dirty buffer projection could regress existing saved-file outline behavior.

Mitigations:

- Decode only bounded state, digest, domain, and summary facts.
- Keep review JSON opaque and off the drawer in this cycle.
- Preserve existing saved-file outline/diff tests and route only `.edict` live
  buffer requests to the Edict projection path.

## Follow-On Debt

Known deferrals in this cycle:

- generic projection-lane panel:
  https://github.com/flyingrobots/jedit/issues/258
- full Core/Target IR review JSON viewer:
  https://github.com/flyingrobots/jedit/issues/259
- Echo run button from jedit:
  https://github.com/flyingrobots/jedit/issues/257
- canonical Echo receipt digest display:
  https://github.com/flyingrobots/jedit/issues/260

## Retrospective

What changed from the design:

- The implementation kept the display-only scope but intentionally did not map
  Graft/Edict `echoReceipt` slots through the live `.edict` projection helper.
  Existing obstruction receipt display remains on the already validated
  `file_outline` adapter path until jedit owns a JSON decoder for that slot
  shape without accepting `unknown` payloads.
- The adapter uses a local process-runner boundary because Graft exports the
  Edict provider factory but not its Node process runner.

What the tests proved:

- `spec/workspace-graft-refresh.spec.mjs` proves refresh commands pass current
  editor lines as `sourceText`.
- `spec/graft-api-session.spec.mjs` proves dirty `.edict` source text reaches
  the Graft/Edict projection surface and Core/Target IR slots normalize into
  `GraftInfo`.
- `spec/graft-drawer.spec.mjs` proves the drawer renders Core and Echo Target
  IR rows, keeps receipt display opaque, and does not claim execution or
  admission.

What remains open:

- Generic projection-lane panel: https://github.com/flyingrobots/jedit/issues/258
- Full Core/Target IR review JSON viewer:
  https://github.com/flyingrobots/jedit/issues/259
- jedit Echo run button: https://github.com/flyingrobots/jedit/issues/257
- Canonical Echo receipt digest display:
  https://github.com/flyingrobots/jedit/issues/260

PR:

- https://github.com/flyingrobots/jedit/pull/<number>
