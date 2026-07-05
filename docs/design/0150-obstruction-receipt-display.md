---
title: "WF-0150 - Obstruction Receipt Display"
legend: "WF"
lane: "implementation"
issue: "https://github.com/flyingrobots/jedit/issues/212"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-07-05"
updated: "2026-07-05"
---

# WF-0150 - Obstruction Receipt Display

## Linked Issue

- https://github.com/flyingrobots/jedit/issues/212

## Decision Summary

jedit will render an optional opaque obstruction receipt projection lane in the
Graft drawer when upstream Graft/Edict metadata supplies one. The drawer shows
carried facts such as outcome kind, Target IR digest, reason kind, and reason
payload, but it does not execute Echo, admit Jim artifacts, compute receipt
digests, or interpret domain-specific obstruction meaning.

## Sponsored Human

A Jim user wants to inspect why an Edict/Echo projection ran into an obstruction
so that they can see the receipt facts beside existing Graft projection context,
without mistaking that display for jedit runtime admission or execution.

## Sponsored Agent

An agent needs a stable display-side slot for obstruction receipt facts so it
can verify that jedit preserves upstream receipt evidence, without scraping
strings from Echo, Edict, or Graft internals.

## Hill

By the end of this cycle, the Graft drawer can display an opaque obstruction
receipt projection supplied through `GraftInfo`, and a focused spec proves the
drawer preserves the carried facts without rendering a receipt digest or
reclassifying the receipt as hard rejection or scheduler counterfactual.

## Current Truth

On `origin/main` at
`daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e`, `GraftInfo` carries path,
projection source/posture, outline rows, change lines, notice, and error, but no
receipt lane:
[`src/ports/graft-session.ts#L20:daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e`](https://github.com/flyingrobots/jedit/blob/daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e/src/ports/graft-session.ts#L20).

The Graft drawer currently renders `graft`, path, projection source, projection
posture, loading/notice, error, and outline sections:
[`src/ui/graft-drawer.ts#L64:daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e`](https://github.com/flyingrobots/jedit/blob/daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e/src/ui/graft-drawer.ts#L64).

The active bearing warns that graph-backed rope runtime authority is a hard gate
for new jedit causal-storage UI claims:
[`docs/BEARING.md#L35:daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e`](https://github.com/flyingrobots/jedit/blob/daf07936b4a4ee1047fac0224e20a5bd2d4c0e5e/docs/BEARING.md#L35).
This slice stays outside that gate by displaying external projection evidence
only; it does not claim jedit text-runtime authority.

## Problem

After the Edict, Echo, and Graft obstruction-strand slices, jedit has no display
surface for an upstream Echo obstruction receipt projection. Without a narrow
display lane, future UX would either hide receipt evidence or be tempted to map
it into existing error, rejection, or counterfactual labels. That would collapse
separate meanings.

## Scope

This cycle includes:

- adding a typed optional obstruction receipt projection to `GraftInfo`;
- rendering receipt, outcome, target, reason, and reason payload rows in the
  Graft drawer;
- preserving the receipt as upstream evidence, not jedit-owned semantics;
- proving the drawer does not render a receipt digest before canonical receipt
  bytes exist;
- keeping existing Graft saved-file drawer behavior unchanged.

## Non-Goals

This cycle does not include:

- Echo execution;
- Jim admission;
- Graft dependency upgrades;
- canonical Echo receipt bytes;
- receipt digests;
- scheduler counterfactual exploration;
- jedit text-runtime causal authority claims.

## User Experience / Product Shape

The receipt lane appears inside the Graft drawer above the outline section when
`GraftInfo.obstructionReceipt` is present.

### Wide UI Mockup

```text
graft
demo.edict
source: live-buffer
posture: current


receipt
outcome: obstructed_strand
target: echo.span-ir/v1 sha256:333333...
reason: jim.EditObstruction.StaleBase
payload: inputBasisDigest=sha256:111111...
payload: observedBasisDigest=sha256:444444...
outline
structural outline unavailable
```

### Narrow UI Mockup

The drawer keeps the same line-fitting behavior as existing Graft rows. Long
digests and payload entries are truncated by drawer width rather than wrapping
into adjacent UI.

### Accessibility Considerations

The lane uses plain text labels and does not rely on color. The receipt facts
are visible through the same drawer text representation used by tests and
terminal rendering.

## Runtime / API Contract

`GraftInfo` gains:

```ts
type GraftObstructionReceiptProjection = {
  outcomeKind: string;
  targetIrDigest: string;
  targetIrDomain?: string;
  reasonKind?: string;
  reasonPayload?: GraftJsonObject;
  receiptReview?: GraftJsonObject;
};
```

`receiptReview` is opaque. jedit may carry it but does not interpret it.

The drawer renders:

- `receipt`
- `outcome: <outcomeKind>`
- `target: <targetIrDomain> <targetIrDigest>` when domain is present
- `target: <targetIrDigest>` otherwise
- `reason: <reasonKind>` when present
- one deterministic `payload: <key>=<value>` row per payload key

The drawer must not render a receipt digest. A future cycle can add that only
after Echo or Edict freezes canonical receipt bytes.

## Lower Modes

The lower mode is the existing text drawer output. Tests assert the rendered
lines directly.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | Upstream Graft/Edict/Echo projection metadata. |
| Derived state | Drawer text rows. |
| Invalid states | jedit interpreting receipt semantics or rendering a digest without canonical bytes. |
| Reset behavior | Receipt disappears when `graftInfo` is absent or replaced. |
| Serialization | No new persistence. |
| Deterministic assumptions | Payload keys render in sorted order. |

## Retrospective

The cycle stayed display-only. `GraftInfo` now carries an optional opaque
obstruction receipt projection, and the Graft drawer renders the receipt
outcome, Target IR binding, reason kind, and sorted reason payload rows without
claiming Echo execution or Jim admission authority.

The RED spec first failed because the drawer rendered no receipt lane. The
GREEN implementation added the typed receipt shape, receipt rows, deterministic
payload ordering, and drawer pagination that counts receipt payload rows rather
than using a fixed estimate.

Validation:

- `npm run build && JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/graft-drawer.spec.mjs`
- `npm run --silent quality`
- `npx markdownlint-cli2 CHANGELOG.md docs/design/0150-obstruction-receipt-display.md`
- `git diff --check`
- `npm run check`

Follow-up work remains in the upstream stack: this PR does not bump the Graft
package dependency, create canonical receipt bytes, or add jedit-side runtime
authority over Echo obstruction semantics.
