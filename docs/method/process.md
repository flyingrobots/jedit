# Process

This document defines how jedit cycles start, move, prove, and land.

## Cycle Doctrine

A design doc defines intent. It does not prove implementation.

Every implementation cycle must name at least one executable witness that
exercises the real software surface: package API, runtime behavior, rendered
output, scripted app flow, command behavior, schema validation, lower-mode
output, or CI/tooling behavior.

Design-doc assertions may be tested as evidence-ledger checks, but they cannot
be the only acceptance test for product, runtime, UI, or tooling work.

A good jedit design doc is specific enough that another engineer or agent can
write the RED test from it without asking what behavior is supposed to exist. A
bad design doc mostly says that a document exists, a feature would be nice, or a
user will be happier, without naming the contract, failure mode, lower mode, or
proof.

## Design Classes

Use the smallest design class that still produces executable proof.

| Class | Required for | Required artifact |
| --- | --- | --- |
| Full cycle design | New features, architecture changes, user-visible flows, CI/tooling architecture, runtime contracts, data/state changes, or work spanning more than one slice. | `docs/design/<id>-<slug>.md` using `docs/design/TEMPLATE.md`. |
| Mini design | Narrow bug fixes where current truth, problem, contract, test, and acceptance criteria fit in the issue or PR body. | Issue or PR text with those fields. |
| No design doc | Mechanical cleanup, typo fixes, dependency metadata, or changes with no behavioral/API/process consequence. | Commit and PR summary are enough. |

If an agent cannot name the RED test from the issue or design, the design is not
specific enough.

## Starting A Full Cycle

1. Fetch refs from the merge target remote.
2. Create a new branch from the merge target, almost always `origin/main`.
3. Create or link a GitHub issue for the cycle.
4. Write the cycle design doc from `docs/design/TEMPLATE.md`.
5. Stage, commit, and push the design doc and any process-only setup.
6. Open an early PR for visibility.
7. Apply `work-in-progress` to the GitHub issue and PR while the cycle is not
   ready.
8. Do the cycle work in small RED/GREEN slices.

Draft PRs are allowed only for cycle kickoff and active cycle work. A draft PR
must become ready for review before merge. If a hosting repo, branch protection,
or automation does not support draft PRs, use a normal PR with the
`work-in-progress` label instead.

Never rebase a cycle branch. If an existing cycle branch must take newer target
branch changes, fetch and merge the target branch normally.

## During A Cycle

- Keep the design checklist current as slices close.
- Check off a slice immediately before committing that slice.
- Each implementation slice should have one primary executable witness.
- Prefer RED first when a meaningful failing witness can be created.
- Do not expand a slice because nearby cleanup is tempting.
- If a slice exposes follow-on work, create a GitHub issue instead of hiding it
  in prose.
- Keep `docs/BEARING.md` current when execution gravity changes.

## Ready For Review

A cycle PR is ready only when:

- The design doc names the implementation result in `Retrospective`.
- The retrospective says what changed from the design.
- The retrospective says what the tests proved.
- The retrospective says what remains open.
- Deferred work has linked GitHub issues.
- Required local validation has passed.
- CI is green or every remaining failure is external and explicitly named.
- `work-in-progress` has been removed from the PR and issue.

## Landing A Cycle

After a cycle lands:

- Keep the design doc as the historical record when it remains useful.
- Move superseded design material into feature docs, retrospectives, or
  `docs/method/graveyard/`.
- Close linked follow-on issues only when their executable witness exists.
- Do not treat a landed design doc as runtime truth. Tests, code, generated
  artifacts, command output, and user-visible behavior are the proof.
