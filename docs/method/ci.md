# Continuous Integration

This document owns how Jedit CI decides what to run. The executable rules live in `scripts/ci/` and `.github/workflows/ci.yml`; when this page and those files disagree, the scripts are right and this page is wrong.

## Jobs

`.github/workflows/ci.yml` runs these jobs:

| Job | Runs |
| --- | --- |
| `plan` | `scripts/ci/changed-shards.mjs` chooses the test shards and whether the release gate runs. |
| `static / build` | `npm ci`, the TypeScript build, and the native Echo host; uploads `dist` and the host binary. |
| `test / <shard>` | One job per planned shard, using the uploaded `dist` with `JEDIT_DIST_PREBUILT=1`. |
| `quality` | `scripts/quality-gate.mjs`, then `scripts/ci/shellcheck.sh` (see [ShellCheck](#shellcheck)). |
| `release-gate / jedit-echo` | The Echo host witness, when the plan requires it. |
| `edict / replace-range package and pure runtime chain` | The pinned Edict and Echo package chain for `edict/replace-range`, plus authored draft module-pin and inventory-provenance checks, on every change. |
| `check` | The required aggregate. It fails if plan, build, quality, or the Edict chain did not succeed, or if shards or the release gate failed rather than being skipped. |

## Shards

`scripts/ci/test-shards.mjs` assigns every spec under `spec/` and `tests/` to exactly one shard by file-name pattern:

| Shard | Scope |
| --- | --- |
| `contract-api` | Contract, codec, observer, operation, and generated API specs. |
| `cycle-proofs` | Cycle proof specs under `tests/`. |
| `echo-authority` | Echo hosting, production text, restart, and release-authority specs. |
| `misc-fast` | Small specs no narrower shard owns. |
| `title-rendering` | Title scene, title screen, mesh, camera, and theme-rendering specs. |
| `workspace-ui` | Workspace, drawer, key binding, footer, editor, panel, and UI interaction specs. |

Specs that import compiled modules load them through `spec/dist-helpers.mjs`, so shard jobs never rebuild TypeScript.

## Planning rules

- The required GitHub check is `check`.
- Pushes to `main`, manual runs with `full`, and pull requests labelled `full-ci` run every shard and the release gate.
- Changes to `.github/`, `scripts/ci/`, the quality gate, TypeScript configuration, or non-Bijou package changes run every shard and the release gate. A package change that only bumps Bijou dependencies runs a narrower compatibility set.
- Contract and generated-contract changes run `contract-api`, `echo-authority`, and the release gate. Echo authority surfaces run `echo-authority`, `workspace-ui`, and the release gate. Workspace, title, and other UI surfaces run their owning shards. Changes under `docs/`, `ARCHITECTURE.md`, and `README.md` run no test shard, because tests never read documentation; other root documents count as unrecognised paths. A changed spec runs its own shard.
- A path the planner does not recognise runs every shard and the release gate.
- Every plan runs build and quality.
- Local `npm run check` runs the build, the full test suite, and the quality gate. ShellCheck runs in CI; run `scripts/ci/shellcheck.sh` locally when ShellCheck is installed.

## ShellCheck

`scripts/ci/shellcheck.sh` runs ShellCheck over every tracked shell script and
over the `pre-commit` and `pre-push` launchers that `scripts/install-hooks.sh`
generates, installed into a throwaway repository. A tracked file counts as a
shell script when it ends in `.sh` or its shebang names `bash` or `sh` (Markdown
files are never read, so they are never shell scripts), either
directly (`#!/bin/sh`) or through a plain `env` (`#!/usr/bin/env bash`, with
optional `NAME=value` assignments). An `env` shebang that uses options, quotes,
or escapes (such as `#!/usr/bin/env -S bash -e`) fails the check with a message
naming the file: use a plain shebang or a `.sh` extension. The classifier is
`scripts/ci/lib/shebang.sh`, pinned by `spec/ci-shellcheck-shebang.spec.mjs`.

## Title-scene freeze

Pull requests that change frozen title-scene paths fail in `plan` unless they carry the `title-unfreeze` label. `scripts/ci/frozen-paths.mjs` defines the frozen patterns, and [title-scene-freeze.md](title-scene-freeze.md) records why the surface is frozen and how the freeze ends.

The authored draft checks run the canonical digest vector, transitive repinning,
current/historical inventory provenance regressions, and `draft-modules.mjs
--check`. The standalone historical character-boundary runtime replay is a
manual guarded Docker witness: its retained compiler/provider inputs are not
part of the CI checkout. It is not counted as full ReplaceRange acceptance.
