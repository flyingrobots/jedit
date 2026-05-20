---
title: "structural-history-replace-text-range-metadata"
legend: "contracts"
cycle: "0016-structural-history-replace-text-range-metadata"
source_backlog: "docs/method/backlog/asap/optic-client-generation-cutover.md"
---

# structural-history-replace-text-range-metadata

Source backlog item:
`docs/method/backlog/asap/optic-client-generation-cutover.md`
Legend: contracts

## Sponsored Users

- A maintainer moving buffer-history authority out of transitional TypeScript
  and into the structural-history GraphQL contract.
- A developer reviewing whether `replaceTextRange` now has generated Wesley
  operation identity instead of another hand-authored string.
- A future agent cutting over more structural-history operations without
  widening the runtime storage migration.

## Hills

1. A maintainer can inspect the structural-history SDL and see
   `replaceTextRange` declared as a Wesley operation whose identity comes from
   generated metadata.
2. A developer can run the normal build and test paths from a clean checkout
   and have the ignored `replaceTextRange` descriptor generated before
   TypeScript imports it.
3. A future runtime slice can call the hot-buffer replace boundary and observe
   generated `replaceTextRange` operation identity while preserving existing
   tick, no-op, and open edit-group behavior.

## Playback Questions

1. Does the structural-history SDL mark `replaceTextRange` with `@wes_op`?
2. Does the structural-history generator emit the Wesley operation descriptor
   from `contracts/jedit/structural-history.graphql`?
3. Is the extracted descriptor ignored generated output rather than a second
   committed source of truth?
4. Does the app boundary import generated operation metadata instead of naming
   `replaceTextRange` by hand?
5. Does routing through that boundary preserve replace admission, logical
   no-op behavior, and open edit-group membership?

## Requirements

- Keep `contracts/jedit/structural-history.graphql` as the authored domain
  contract for structural history.
- Mark `replaceTextRange` as a Wesley operation in that SDL.
- Generate the structural-history Wesley TypeScript artifact during build and
  test without requiring a sibling Wesley checkout.
- Extract only the `replaceTextRange` operation descriptor needed by this
  slice.
- Ignore the extracted descriptor so generated metadata does not become a
  committed peer authority.
- Route the hot-buffer replace boundary through the generated descriptor.
- Preserve the existing in-memory runtime as the executor for this slice.

## Acceptance Criteria

- RED tests fail because the structural-history SDL is not yet consumed by any
  generated adapter-facing metadata.
- GREEN tests prove SDL annotation, generation, ignored descriptor posture,
  app-boundary consumption, and preserved hot-buffer tick behavior.
- `node --test spec/structural-history-contract-readiness.spec.mjs
  spec/structural-history-replace-text-range-metadata.spec.mjs` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

This cycle changes contract authority and adapter metadata, not the visible
editor surface. It must not alter editing controls, footer language, focus
behavior, or screen-reader-relevant text.

## Localization / Directionality Posture

No localized strings or layout direction rules change in this cycle.

## Agent Inspectability / Explainability Posture

The generated route should be explainable from plain repo reads:

- SDL declares the operation.
- Package scripts run generation before build and tests need the descriptor.
- The adapter imports generated metadata at one boundary.
- Specs prove the descriptor is ignored and mirrors Wesley output.

## Implementation Outline

1. Add structural-history SDL authority for text-history operations.
2. Add a build-local structural-history Wesley generation script.
3. Extract the `mutationReplaceTextRangeOperation` descriptor into
   `src/generated/jedit`.
4. Ignore that descriptor and document that it is build output.
5. Add a small app boundary that returns generated `replaceTextRange`
   operation identity while delegating execution to the current runtime port.
6. Update the hot-buffer session to use the boundary.
7. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `structural history SDL marks replaceTextRange as a Wesley operation`
- `structural history generation path emits replaceTextRange metadata`
- `generated replaceTextRange descriptor is ignored and mirrors Wesley metadata`
- `replace/tick adapter consumes generated replaceTextRange operation identity`
- `replaceTextRange metadata route preserves hot buffer tick behavior`

## Drift Check

RED drift matched the design: structural-history authority existed as a
direction, but no generated structural-history artifact was consumed by an app
boundary, and `replaceTextRange` execution still had no generated operation
identity at the session boundary.

Implementation drift is intentional and bounded:

- The generator extracts one descriptor rather than committing the full
  structural-history TypeScript output.
- The generated descriptor is ignored and recreated by build/test.
- Runtime storage, persistent history, and generated payload-shape cutover stay
  out of scope.

## Playback

Playback answers:

1. `replaceTextRange` is declared in the structural-history SDL with
   `@wes_op(name: "replaceTextRange")`.
2. `npm run gen:contract:structural-history:wesley` emits the Wesley output and
   extracts `mutationReplaceTextRangeOperation`.
3. `.gitignore` excludes the extracted descriptor, and tests prove it is not
   tracked.
4. `src/app/structural-history-replace-text-range.ts` imports the generated
   descriptor and exposes the generated operation name.
5. The hot-buffer session still admits replace ticks, preserves no-op behavior,
   and includes admitted ticks in open edit groups.

Validation:

- `npm run check` passed.
- `git diff --check` passed.

## Retrospective

Keeping this as a one-operation metadata slice made the authority shift
reviewable. The generated operation name is now real runtime evidence at the
app boundary, while the broader storage and generated-payload migration remains
deferred to a later cycle.
