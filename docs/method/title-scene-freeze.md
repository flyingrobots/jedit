---
scaffold: title-scene-freeze
repo: jedit
introduced_by:
  cycle: WF-0154
  issue: 267
  date: 2026-07-12
  title: "WF-0154 - E-Brake: Observed Absurdity Fixes"
reason: |
  The 2026-07-12 forensic audit found src/ui/title-screen.ts is the
  most-modified file in the repository (55 commits, 18 fix-prefixed),
  and the ray-traced title subsystem spans ~50 files across five path
  roots while roadmap goalposts (provenance, historical preview,
  proposal strands) remain unshipped. The title scene is done and
  beautiful; revision effort on it is now misallocated. This leash
  freezes the surface so effort flows to the causal product loop.
enforcement: |
  scripts/ci/frozen-paths.mjs defines the frozen patterns:
  src/ui/title-*, src/ui/*.obj, src/app/title-*,
  src/app/workspace/title-*, src/adapters/title-*,
  src/adapters/raytracer-profiler.ts, scripts/title-*.
  scripts/ci/changed-shards.mjs --enforce-frozen fails the CI plan
  step when a pull request changes a frozen path; the workflow passes
  the flag on pull_request events unless the PR carries the
  title-unfreeze label. Push-to-main and dispatch runs never enforce,
  so labeled merges cannot brick main. Witness:
  spec/ci-frozen-paths.spec.mjs.
deletion_trigger:
  repo: jedit
  description: |
    Delete this leash (and the --enforce-frozen wiring) when a release
    or demo cycle explicitly budgets title-scene work through a design
    doc that names this file, or when the causal product loop
    (explain -> preview -> admit -> recover) is demo-complete and the
    roadmap re-opens presentation polish.
escape_hatch: |
  Apply the title-unfreeze label to a pull request to admit a
  deliberate title-scene change without deleting the leash.
---

# title-scene-freeze

The ray-traced title scene is frozen. It stays exactly as beautiful as it is
today. PRs that touch frozen title paths fail the CI plan step unless they
carry the `title-unfreeze` label. See frontmatter for enforcement, escape
hatch, and the deletion trigger.
