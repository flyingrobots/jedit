---
title: optic-client-generation-cutover
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - optic
  - wesley
  - generated
  - echo
  - cutover
acceptance_criteria:
  - The fake/direct optic client and the future Wesley-generated Echo client share one app-facing port.
  - Generated contract types become the source of input and reading shapes for optic operations.
  - App code does not depend on fake-only operation names, codecs, or transport shortcuts.
  - The cutover plan names exactly which adapter can be deleted when Echo supports hosted contract optics.
  - Existing optic tests can run against the fake and later against a real Echo adapter with minimal fixture changes.
---

# optic-client-generation-cutover

Prepare the eventual switch from fake/direct Optic clients to Wesley-generated
Echo Optic clients.

Context:

- `jedit` can do useful internal work before Echo ships contract optics.
- That work must not create a second permanent client model.
- The port should stay stable while adapters change beneath it.

This task should define the cutover boundary so the fake remains a scaffold,
not a forked runtime.

## Current Safe Slice

`jedit` now has a local readiness gate for the existing authored contract:

- `contracts/jedit/hot-text-runtime.graphql` remains the canonical SDL surface.
- `src/generated/jedit/hot-text-runtime.wesley.generated.ts` remains the
  generated operation metadata used by the current TypeScript adapter layer.
- `spec/hot-text-contract-readiness.spec.mjs` verifies that mutation
  `@wes_footprint` metadata and bounded read operations are preserved before
  any Echo Rust binding generation runs.
- `contracts/jedit/structural-history.graphql` is now the canonical product
  structural-history SDL.
- `scripts/gen-structural-history-wesley.mjs` uses published `wesley-cli` 0.0.4
  to emit the full structural-history TypeScript artifact into `.wesley-cache`
  and extract the ignored `replaceTextRange` operation descriptor consumed by
  `src/app/structural-history-replace-text-range.ts`.
- `spec/structural-history-replace-text-range-metadata.spec.mjs` verifies that
  the descriptor is ignored, mirrors Wesley output, and drives the hot-buffer
  adapter operation identity without changing storage behavior.

The deferred Echo-dependent step is:

1. Use the Continuum `jedit-echo-dev` warpspace lock to select the Echo checkout.
2. Run `echo-wesley-gen` against `contracts/jedit/hot-text-runtime.graphql`.
3. Write the generated Rust binding artifact into a jedit-owned Rust contract
   crate.
4. Verify the generated registry artifact with
   `echo_registry_api::verify_contract_artifact(...)`.

Until Echo is free, do not add local sibling `../echo` dependencies to committed
jedit manifests and do not generate a second, divergent SDL file.

## Non-Goals

- Depending on an Echo API that has not shipped yet.
- Preserving fake-only codecs after the generated client exists.
- Rewriting the entire app around generated types in one pass.
