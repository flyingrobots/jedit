# CI Shard And Impact Planning

Status: active

## Claim

Jedit CI should stop treating every pull request as the same monolithic
`npm run check` event. The repository needs a planner that can explain which
checks are necessary for a diff, a shard manifest that accounts for every spec,
and a final aggregate `check` gate that stays conservative when the planner is
unsure.

The goal is shorter iteration time without lowering the release bar.

## Current Baseline

The current GitHub workflow has one job named `check`.

```text
npm run check
-> npm run test
   -> npm run build
   -> node --test --test-concurrency=1 spec/**/*.spec.mjs tests/**/*.spec.mjs
-> npm run quality
```

Recent CI evidence showed checkout, Node setup, and dependency installation
finishing in seconds. The long pole was the single `Run checks` step.

## Design Rules

- The final required GitHub check remains named `check`.
- Each spec belongs to exactly one test shard.
- Unknown paths force the full shard set.
- Workflow, package, TypeScript config, shard-planner, and quality-gate changes
  force the full shard set.
- Mainline pushes and explicit full runs execute the full shard set.
- Echo authority and release-gate paths run the release gate.
- Skipped shards must be explainable from the changed path set.
- Local `npm run check` remains the full local truth.

## Shards

| Shard | Scope |
| --- | --- |
| `contracts` | Contract, codec, observer, operation, and algebra specs. |
| `docs-release` | Documentation, guide, quickstart, and release-script specs. |
| `echo-authority` | Echo hosting, recovery, production text, WSC, restart, retained evidence, and release authority specs. |
| `misc-fast` | Small specs that are not owned by a narrower domain shard. |
| `title-rendering` | Title scene, title screen, mesh, camera, and theme-rendering specs. |
| `workspace-ui` | Workspace, drawer, key binding, footer, editor, panel, source, markdown, and UI interaction specs. |

Static build and quality are separate non-test jobs. The release gate is a
separate conditional job.

Shard jobs receive the `dist` artifact from the build job and set
`JEDIT_DIST_PREBUILT=1`. Specs that import compiled modules must use the shared
`spec/dist-helpers.mjs` loader path so shard jobs do not rebuild TypeScript or
depend on ignored generated source files in a fresh checkout.

## Path Impact Rules

| Changed path | Required checks |
| --- | --- |
| `.github/**`, `package*.json`, `tsconfig*.json`, `scripts/ci/**`, `scripts/quality*` | Full shard set and release gate. |
| `contracts/**`, generated contract code, Wesley tooling | `contracts`, `echo-authority`, release gate. |
| Echo authority surfaces | `echo-authority`, `workspace-ui`, release gate. |
| Workspace surfaces | `workspace-ui`, `echo-authority`. |
| Title scene and theme surfaces | `title-rendering`, `workspace-ui`. |
| UI surfaces outside title/workspace | `workspace-ui`. |
| Docs and README | `docs-release`. |
| Tests | The owning shard for the changed test. |
| Unknown paths | Full shard set and release gate. |

Every plan also runs static build and quality.

## Ten Slices

- [x] Slice 1: record baseline and define the CI split design.
- [x] Slice 2: add the shard manifest and every-spec coverage check.
- [x] Slice 3: add the changed-path impact planner.
- [x] Slice 4: add shard runner scripts and package commands.
- [x] Slice 5: add shared prebuilt-dist support for specs that used to rebuild
  dist.
- [x] Slice 6: add planner/shard tests.
- [x] Slice 7: split GitHub Actions into plan, build, shard, release-gate,
  quality, and aggregate `check` jobs.
- [x] Slice 8: add job summaries and timing/profiling support.
- [x] Slice 9: keep local full `npm run check` semantics intact.
- [x] Slice 10: validate the new planner, shards, quality, and full check.

## Non-Goals

- No branch-protection changes in this repository change.
- No weakening of the Echo release gate.
- No attempt to make dependency installation the primary optimization target.
- No test deletion.

## Merge Gate

This campaign is ready when:

- The shard coverage check proves every spec is assigned to exactly one shard.
- The changed-path planner proves docs-only, workspace, Echo authority, and
  unknown-path cases.
- `npm run check` remains green locally.
- GitHub CI reports a final aggregate `check` job and exposes shard-level jobs.
- Shard jobs import compiled modules from the downloaded build artifact instead
  of running per-spec TypeScript rebuilds.
