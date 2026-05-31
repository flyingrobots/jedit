---
title: generated-rope-codec-manual-fixes
lane: bad-code
owner: jedit transport
priority: high
keywords:
  - generated-code
  - codec
  - wesley
  - jedit
  - trailing-bytes
  - regen
blocked_by:
  - Wesley TS emitter support for top-level vars trailing-byte checks
acceptance_criteria:
  - Wesley TS emitter generates top-level vars trailing-byte checks.
  - Regenerating jedit/src/generated/jedit/rope.codec.generated.ts preserves the checks.
  - Tests fail (RED) if generated vars decoders accept trailing bytes.
  - No manual post-generation edits remain in generated codec output.
---

# Generated rope codec carries hand-edits that regen would erase

## The smell

`src/generated/jedit/rope.codec.generated.ts` is marked as generated
output, but it currently carries hand-applied behavior:

- Trailing-byte rejection in the top-level vars decoders
  (`decodeCreateBufferWorldlineVars`, `decodeReplaceRangeAsTickVars`,
  `decodeCreateCheckpointVars`, plus the two query vars decoders) was
  added by commit `6da5a8f` ("Fix: reject trailing bytes in top-level
  vars decoders"). The check uses `Reader.remaining()` and throws
  `CodecError` when bytes remain after a structurally-complete decode.

The commit message itself flagged the risk:

> Same regeneration caveat as previous codec edits (commits 640b07d
> and b1eed88): a regen will need the wesley emitter to produce this
> check too.

That caveat is the bug. The file says "generated. Do not edit." and
yet it carries an edit. The next time someone runs the codegen
pipeline against this schema, the trailing-byte checks vanish, the
fix is undone silently, and the canonical-vars-plus-garbage replay /
submission-identity invariant break it was added to prevent comes
back.

This is structurally identical to the two earlier hand-edits in the
same file (commits `640b07d` and `b1eed88`). Three accumulated hand-
edits without a regen-resistance story is now an explicit anti-
pattern.

## Why this matters

- The replay / submission-identity invariant ("canonical input bytes
  uniquely identify the mutation submission") depends on the
  trailing-byte check. Losing it means two distinct byte strings can
  decode to the same operation under different recorded submission
  IDs.
- Regen pressure will arrive naturally with Wesley updates, schema
  changes, or the 0025 Phase 2 migration that touches the rope
  schema and Session attribution. Any of those triggers the bug.
- The contract that generated output is regenerable is a load-
  bearing METHOD assumption — Wesley is the contract compiler. A
  generated file that requires hand-fixes silently breaks that
  contract for every downstream user.

## The fix shape

Two-step:

1. **Upstream**: the Wesley TypeScript emitter learns to emit the
   trailing-byte check as part of every top-level vars decoder. The
   shape is mechanical — after decoding all declared fields, assert
   `r.remaining() === 0` and throw `CodecError` otherwise. The Rust
   emitter side is parallel; if it already does this, the TS emitter
   just mirrors the policy.
2. **Downstream**: regenerate `rope.codec.generated.ts` from the
   updated emitter. Diff against the hand-edited version. Diff must
   be empty (or trivially equivalent — formatting only). If non-
   empty, the emitter is missing a case.

Then `spec/rope-codec.spec.mjs` keeps its existing trailing-byte
regression tests as the gate: any future regen that drops the
checks turns those tests red immediately, before the broken file
gets committed.

## Related cards

- `docs/method/backlog/bad-code/optic-codec-mixes-wire-with-session.md`
  — sibling concern about a different codec file carrying transport-
  level conflation. Both want the same Wesley-emitter alignment.
- `echo/docs/method/backlog/bad-code/echo-wesley-gen-local-emitter-duplication.md`
  (companion) — echo carries a parallel set of hand-applied
  generator behavior (codec_id normalization, trait imports,
  fnv1_step naming, no_std ID list encoding) waiting on the same
  wesley-core / emitter alignment.

## Out of scope here

- Implementing the Wesley emitter change. That belongs in the
  Wesley repo (or its echo-vendored copy, if relevant) and lands
  behind a regen + diff-empty proof.
- Re-running the regen pipeline against the current emitter and
  shipping the result. This card stays open until the regen
  preserves the trailing-byte checks AND the rest of the hand-
  edited surface.

## Trigger

Resolve this card when:

1. The Wesley TS emitter emits the trailing-byte check for every
   top-level vars decoder.
2. A regenerated `rope.codec.generated.ts` compiles, passes
   `spec/rope-codec.spec.mjs` (including the trailing-byte
   regressions), and shows zero functional drift from the current
   hand-edited file.
3. The commit-message caveat about "regen will need the wesley
   emitter to produce this check too" no longer applies and can be
   removed from any future codec-related commit.
