---
scaffold: JeditWorldlineSessionPort
repo: jedit
introduced_by:
  pr: 33
  merged_sha: 90245c73
  date: 2026-05-30
  title: "feat(transport): jedit Slice A+B EINT cutover with first-class session port"
reason: |
  Echo cycle 0024 (universal LE binary codec) landed the wire-level
  codec that the EINT cutover needs, but cycle 0025 (sessions as
  causal contexts) only landed Phase 1 design — there is no engine-
  side first-class Session / WorldlineId surface yet. To unblock the
  jedit transport cutover without waiting on cycle 0025 Phase 2 GREEN,
  PR #33 carries a client-side transitional session-port mirror so
  the optic client can register a JeditWorldlineSession before each
  call and the transport can look it up by the worldlineId embedded
  in the decoded input. The cross-repo coordination argument was the
  rebuttal posted on the resolved coderabbit Major thread at
  src/ports/jedit-worldline-session-port.ts:30.
deletion_trigger:
  repo: echo
  cycle: "0025-sessions-as-causal-contexts"
  phase: "Phase 2 GREEN"
  description: |
    Once warp-core ships engine-side Session and WorldlineId as first-
    class types (Phase 2 GREEN of echo cycle 0025), jedit deletes this
    scaffold and threads SessionId / IntentId / IngressAddress through
    instead. No client-side causal-context mirroring after that point.
symbols:
  - JeditWorldlineSessionPort
  - JeditWorldlineSessionNotRegisteredError
  - JeditWorldlineId
  - JeditTransportSeam
  - createInMemoryJeditWorldlineSessionPort
  - installed-jedit-eint-bridge
files:
  - src/ports/jedit-worldline-session-port.ts
  - src/ports/jedit-transport-seam.ts
  - src/adapters/in-memory-jedit-worldline-session-port.ts
  - src/adapters/installed-jedit-eint-bridge.ts
  - spec/in-memory-jedit-worldline-session-port.spec.mjs
  - spec/installed-jedit-eint-bridge.spec.mjs
status: active
companion_cards:
  - docs/method/backlog/asap/sessions-migration.md
  - docs/method/backlog/bad-code/optic-codec-mixes-wire-with-session.md
related_threads:
  - "PR #33 / src/ports/jedit-worldline-session-port.ts:30 (resolved, rebutted with cross-repo coordination rationale)"
convention_card: echo/docs/method/backlog/cool-ideas/METHOD_leash-files.md
---

# Leash: `JeditWorldlineSessionPort` (and the surrounding transitional session surface)

This file is the structural, machine-readable record of the
`JeditWorldlineSessionPort` scaffold's deletion contract. It is
maintained as a sibling to the prose narrative card in
`docs/method/backlog/asap/sessions-migration.md`; the prose is for
humans, this file is for tooling. See
[`echo/docs/method/backlog/cool-ideas/METHOD_leash-files.md`](https://github.com/flyingrobots/echo/blob/main/docs/method/backlog/cool-ideas/METHOD_leash-files.md)
for the convention this file follows.

## What is on the leash

The transitional session surface introduced by PR #33 — the
worldline session port itself, its in-memory adapter, the transport
seam that prevents jedit-specific state from leaking back into the
generic `EchoWasmKernelTransport`, the installed EINT bridge that
mediates between the optic client and the kernel transport, and the
associated spec files. These exist because Echo's engine has not yet
published a first-class Session type; once it does, this whole layer
collapses into a thin "thread `SessionId` through" pattern and the
named symbols are deleted.

## Deletion proof

When the deletion trigger fires (echo cycle 0025 Phase 2 GREEN),
the scaffold is considered deleted only when:

1. `git grep` for each entry in `symbols` returns zero hits in
   `src/` and `spec/`.
2. The `companion_cards` are also retired:
   - `docs/method/backlog/asap/sessions-migration.md` moves to
     `docs/method/retro/<cycle>/` with the deletion SHA appended.
   - `docs/method/backlog/bad-code/optic-codec-mixes-wire-with-session.md`
     is fully resolved (not just partially), per its own acceptance
     criteria.
3. This leash file moves to `docs/method/graveyard/leash/` with the
   deletion SHA appended.

## Adjacent symbols deliberately NOT on the leash

- `JeditWorldlineSession` (from `src/app/jedit-contract-runtime.ts`)
  is the real contract-runtime session and survives Phase 2; only
  its identity backing changes. The `JeditWorldlineId` alias is on
  the leash because its replacement by the engine-side `WorldlineId`
  is part of the Phase 2 GREEN contract per its own JSDoc on
  `src/ports/jedit-worldline-session-port.ts:11-30`.
- The fake/installed transport adapters, optic-client surfaces, and
  EINT codecs survive Phase 2 too; they thread `SessionId` through
  instead of carrying client-side causal state. Do not leash them
  here.

## What this scaffold is NOT

- Not a long-term API. Anything that grows out of these symbols
  during the leash window should be considered guilty until proven
  innocent; bias toward declining new responsibilities on the
  session-port surface.
- Not the right home for new transport features. New transport
  capability that would otherwise want to live here should be
  weighed against landing it on the engine side post-Phase-2
  instead.

## When the leash fires

The trigger condition (`echo cycle 0025-sessions-as-causal-contexts /
Phase 2 GREEN`) closes when warp-core ships the engine-side
SessionId / WorldlineId / SessionEventLog / admission gate / system
genesis session surface called out in
`echo/docs/design/0025-sessions-as-causal-contexts/design.md` and
`echo/docs/design/0025-sessions-as-causal-contexts/phase-2-handoff.md`.

At that point, jedit's response is the migration described in the
companion `asap/sessions-migration.md` card:

- Jedit holds only a `SessionId` after migration, with no client-side
  cache of engine causal state.
- The named symbols above are deleted.
- The optic client surface uses sessionId-addressed intent submission
  and receives engine-emitted lifecycle events.
- `optic-codec-mixes-wire-with-session.md` is fully resolved.

## What this leash blocks

If new code is being added to any of the named symbol surfaces while
this leash is `active`, the right move is almost always to write the
new capability in shape-of-Phase-2 (a thin pass-through that will
trivially survive the deletion) rather than as a fully-featured port-
side implementation. If that turns out to be impossible for a real
near-term need, escalate by promoting this leash to the `escalated`
status and tagging the next cycle.
