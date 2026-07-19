---
title: "DL-0158 - ReplaceRange Canonical Fact Law And Oracle"
legend: "DL"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/292"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-07-19"
updated: "2026-07-19"
---

# DL-0158 - ReplaceRange Canonical Fact Law And Oracle

## Linked Issue

- [#292 Freeze the ReplaceRange text-fact law and differential oracle](https://github.com/flyingrobots/jedit/issues/292)

## Decision Summary

Jedit will publish one machine-readable `jedit.text.schema@1` declaration for
the native text facts used by production `ReplaceRange`, together with a
committed differential corpus regenerated from the current handwritten rope
planner. Version 1 preserves the existing compact, field-ordered UTF-8 JSON
fact bytes, node-alpha atom storage, domain-separated BLAKE3 identities, and
edge-free native graph representation. The richer TypeScript graph-rope model
is not silently merged into this surface: propositions absent from the native
runtime are explicitly excluded, and any future structural-edge or codec
migration must be a separately admitted operation.

## Sponsored Human

A Jim maintainer wants the first Edict-authored `ReplaceRange` operation to
preserve existing production text and history exactly, without discovering
during cutover that Edict and Echo compiled against a different rope model.

## Sponsored Agent

An Echo or Edict agent needs exact, digest-locked fact, codec, identity, and
finite-corpus resources so it can implement and verify the target operation
without importing Jedit's handwritten planner or inferring semantics from
TypeScript types.

## Hill

By the end of this cycle, a clean Jedit checkout can regenerate the canonical
text-schema declaration and every `ReplaceRange` oracle case from the current
planner, compare exact bytes and identities with committed resources, and fail
when the production fact law or finite semantic corpus drifts.

## Current Truth

The merge target is
[`c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/commit/c70e12d73b4b00bc92412bab67e1761f7dd22f82).

- The production host defines eight native text fact types. `ReplaceRange`
  reads or writes seven of them: Buffer, Blob, Leaf, Branch, Head, Rewrite,
  and Diff.
  [`native/jedit-echo-host/src/records.rs#L7:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/records.rs#L7)
- Native fact bytes are produced by `serde_json::to_vec`; content-addressed
  fact identifiers hash an exact per-fact domain followed by those bytes.
  [`native/jedit-echo-host/src/records.rs#L123:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/records.rs#L123)
- The planner stores each fact as one typed node plus one node-alpha atom
  attachment. It emits no Echo edges and deletes no retained nodes.
  [`native/jedit-echo-host/src/rope.rs#L217:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/rope.rs#L217)
- `plan_replace` enforces the canonical-head basis, half-open UTF-8 byte
  range, exact no-op refusal, checked sequence/version increments, persistent
  split/build/join, immutable Head/Rewrite/Diff creation, and Buffer advance.
  [`native/jedit-echo-host/src/rope.rs#L385:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/rope.rs#L385)
- Rope construction caps leaves at 4,096 UTF-8 bytes, path-copies slices,
  and deterministically height-balances joins.
  [`native/jedit-echo-host/src/rope/tree.rs#L9:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/rope/tree.rs#L9)
- The TypeScript graph-rope model contains propositions and fields that are
  not equivalent to the native retained representation. It is therefore not
  an alternate serialization of the same version-1 schema.
  [`src/domain/graph-rope-types.ts#L85:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/src/domain/graph-rope-types.ts#L85)

Echo ADR 0023 assigns the fact schemas, codec/identity law, operation
semantics, and differential corpus to Jedit. This cycle earns those Jedit-owned
inputs; it does not claim that Echo can execute them yet.

## Problem

The production behavior is deterministic, but its cross-repository contract
is implicit in Rust struct order, serde behavior, private planner state, and
hash-domain constants. Edict cannot bind an exact Jedit lawpack and Echo cannot
validate or interpret one without choosing a schema and codec. Choosing the
richer TypeScript model would silently migrate production history; choosing
the native model without a published declaration would leave package closure
dependent on source-code interpretation.

The current tests cover useful behavior, but they do not publish the exact
initial fact graph, invocation bytes, ordered writes, actual read/write
support, resulting facts, and obstruction posture needed for a separately
implemented Echo evaluator comparison.

## Scope

This cycle includes:

- one versioned, machine-readable canonical text-schema declaration;
- the seven native fact shapes used by `ReplaceRange`;
- exact compact JSON codec, attachment, type-label, and identity laws;
- a type-level split between ordinary typed facts and content-addressed facts,
  so the mutable keyed Buffer fact cannot accidentally receive a second
  content-derived identity;
- explicit fixed-width ranges and UTF-8 requirements;
- an explicit no-edge posture for version 1;
- explicit exclusion and migration posture for TypeScript-only propositions;
- deterministic success cases for insertion, deletion, Unicode replacement,
  cross-leaf replacement, and replacement larger than one leaf;
- deterministic obstruction cases for stale basis, malformed/out-of-bounds
  range, invalid UTF-8 boundary, no-op, and arithmetic overflow;
- exact committed initial graph, invocation, read/write support, ordered patch,
  result, and obstruction evidence for each case;
- byte-for-byte regeneration tests and checked SHA-256 resource digests.

## Non-Goals

This cycle does not include:

- an Echo operation-program ABI or evaluator;
- an Edict target lowerer, package, or generated client;
- production invocation, routing, fact-byte, or identity changes;
- an application callback, native rope intrinsic, or caller-supplied patch;
- unifying the TypeScript and native graph-rope models;
- migrating existing JSON facts to CBOR or structural Echo edges;
- checkpoint, `TextWindow`, save/export, causal diff, or authorization work;
- Cyber Kitten runtime machinery, child lanes, wormholes, or Continuum.

## User Experience / Product Shape

Not applicable. This cycle freezes a machine contract and conformance corpus;
it changes no editor command, rendering, input behavior, or user-visible text.

### Accessibility Considerations

Not applicable. The resources are structured UTF-8 JSON consumable without a
visual interface. Hex-encoded bytes always have adjacent semantic field names.

## Runtime / API Contract

The declaration coordinate is `jedit.text.schema@1`. Its exact bytes receive a
SHA-256 digest for Edict resource binding. That digest is substitution
evidence only; it does not confer an operation coordinate, invocability, or
Echo authority.

Version 1 declares:

| Fact | Type label | Identity posture |
| --- | --- | --- |
| Buffer | `jedit.text.BufferWorldline.v1` | Stable buffer-key node identifier only; canonical bytes may change at that node. |
| Blob | `jedit.text.TextBlob.v1` | Content-addressed from canonical fact bytes. |
| Leaf | `jedit.text.RopeLeaf.v1` | Content-addressed from canonical fact bytes. |
| Branch | `jedit.text.RopeBranch.v1` | Content-addressed from canonical fact bytes. |
| Head | `jedit.text.RopeHead.v1` | Content-addressed from canonical fact bytes. |
| Rewrite | `jedit.text.RopeRewrite.v1` | Content-addressed from canonical fact bytes. |
| Diff | `jedit.text.RopeDiff.v1` | Content-addressed from canonical fact bytes. |

Each graph fact is represented by one typed Echo node and one node-alpha atom
whose atom type equals the node type and whose payload is the canonical fact
bytes. Version 1 has no structural edge propositions. Relationships such as
Head-to-root and Branch-to-child are exact 32-byte identifiers in canonical
record fields.

Canonical fact JSON is:

- UTF-8 with no byte-order mark or insignificant whitespace;
- one object whose fields occur in declaration order;
- decimal unsigned integers with no leading zeroes;
- exact `null` for absent optional identifiers;
- 32-byte identifiers and digests encoded as arrays of 32 decimal octets;
- byte strings encoded as arrays of decimal octets;
- JSON strings encoded with the compact serde-json version-1 escaping profile;
- no maps, floats, signed integers, duplicate members, or unknown members.

This is a writer and identity law. The legacy `serde_json` reader accepts some
noncanonical spellings and does not currently recompute every content node
identifier from attachment bytes. That permissiveness is not promoted into
the version-1 contract. Future package validation and Echo evaluation must
reject noncanonical or misaddressed facts; this cycle does not falsely claim
the compatibility reader already performs those checks.

Content-addressed identifiers are BLAKE3-256 over the exact declared domain
bytes followed by canonical fact bytes. Buffer identifiers, Blob content
hashes, and empty-root digests use their separately declared BLAKE3 domains.
The generic content-fact constructor does not accept Buffer facts. This removes
the currently representable but unused `BufferFact` content identity while
preserving every production byte and authoritative keyed Buffer identifier.

The oracle resource is finite conformance evidence. It does not prove semantic
equivalence for every possible `ReplaceRange` input. Its legacy planner path
must not invoke, link, or share an evaluator implementation with the future
Echo operation program. Sharing the published fact schema and comparison codec
is disclosed and expected.

## Lower Modes

The contract is entirely headless. `cargo test` regenerates and compares the
resources. A deliberately named fixture-update mode may rewrite generated
corpus bytes during development, but CI only checks and never updates them.
Malformed resources fail with ordinary test errors; there is no fallback to
source-code inference.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | Existing native production fact types and `plan_replace` semantics at the merge target. |
| Derived state | Machine-readable schema and finite golden corpus. |
| Invalid states | Noncanonical fact bytes, wrong domains or identities, schema drift, corpus drift, or ambiguous native/TypeScript ownership. |
| Reset behavior | Fixtures regenerate from a clean synthetic graph; no production WAL or user data is read. |
| Serialization | Digest-locked JSON resources containing exact fact bytes as lowercase hexadecimal. |
| Deterministic assumptions | Ordered Rust structs/maps, exact domain bytes, explicit UTF-8 inputs, no clock/randomness/host paths. |

## Accessibility Posture

| Concern | Posture |
| --- | --- |
| Semantic labels or facts | Every identifier and byte vector is labeled by role and fact type. |
| Focus order or ownership | Not applicable. |
| Hidden or visual-only information | None. |
| Keyboard behavior | Not applicable. |
| Secret or redaction behavior | Fixtures contain only synthetic text. |

## Localization / Directionality Posture

| Concern | Posture |
| --- | --- |
| User-visible strings | None. |
| Catalog keys | None. |
| Supported locales updated | No. |
| Directionality assumptions | JSON member order is semantic to the codec; human language direction is irrelevant. |
| Validation command | Native Rust tests plus `npm run check`. |

## Agent Inspectability / Explainability Posture

Agents can inspect one declaration and one corpus manifest without executing
the product or scraping Rust debug output. Every case names its semantic
purpose, exact basis, input, terminal posture, support, facts, and result. The
manifest states the source commit and evidence grade so a consumer cannot
mistake finite-corpus agreement for formal equivalence.

## Linked Invariants

- Jedit owns product semantics and canonical application schemas.
- Echo owns runtime admission, execution, commitment, receipts, and recovery.
- Edict artifacts do not prove that Echo executed them.
- A resource digest supplies substitution evidence, not authority.
- Fixed-width byte coordinates remain `u64`; GraphQL `Int` is not inherited.
- A failed plan produces no parent-visible patch.
- Existing native fact bytes remain stable in version 1.
- Tests are executable specification.

## Design Alternatives Considered

### Adopt the richer TypeScript graph-rope model now

Rejected. It has different propositions and identity material from the native
production graph. Selecting it would make this prerequisite a data migration
and would invalidate the very oracle intended to protect the cutover.

### Migrate version 1 to canonical CBOR or structural edges

Rejected for this cycle. Either change may be desirable, but both alter
retained fact bytes and content identities. They require an explicit migration
operation and compatibility proof rather than being hidden in package work.

### Publish prose plus example snapshots

Rejected. Prose does not constrain field order, exact bytes, hash domains, or
corpus drift. The declaration and corpus must be regenerated and checked by
the implementation that currently owns the law.

### Chosen: freeze native JSON version 1 and a finite differential corpus

This preserves current production history and gives the next Echo slice exact
inputs and outputs. It is intentionally conservative: structural graph schema
evolution can proceed later under a new coordinate and explicit migration.

## Implementation Slices

- [x] Slice 1: land this decision record and freeze the executable witnesses.
- [x] Slice 2: publish and byte-lock `jedit.text.schema@1`.
- [x] Slice 3: publish and regenerate the `ReplaceRange` differential corpus.

## Tests To Write First

- [ ] Schema resource test: regenerate exact bytes, verify the checked SHA-256
      digest, and reject drift from native fact labels, field order, domains,
      attachment posture, and excluded propositions.
- [ ] Type-law test: prove Buffer has no generic content-addressed constructor
      while every immutable ReplaceRange fact retains its existing identifier.
- [ ] Success corpus test: regenerate each initial graph and replacement plan,
      then compare exact reads, writes, patch order, fact bytes, identities,
      result metrics, and preserved facts.
- [ ] Obstruction corpus test: regenerate each failure, compare its Jedit-owned
      semantic category and legacy evidence, and prove no write plan exists.
- [ ] Determinism test: regenerate the complete resources twice from fresh
      synthetic graphs and compare exact bytes.
- [ ] Fixed-width test: retain `u64` values above GraphQL/i32 range in the
      declaration and invocation vectors without narrowing.

## Acceptance Checklist

- [ ] Issue #292 remains the live cycle ledger.
- [ ] The declaration selects the native production model unambiguously.
- [ ] All seven ReplaceRange fact shapes and identity domains are explicit.
- [ ] TypeScript-only propositions and migration posture are explicit.
- [ ] Schema and corpus resource digests are checked from exact bytes.
- [ ] The corpus covers representative persistent-rope successes and typed
      obstructions.
- [ ] No production behavior, fact bytes, authoritative identities, Echo
      dependency, or user-visible behavior changes.
- [ ] Focused Rust tests and `npm run check` pass.
- [ ] The retrospective records evidence limits and the exact next Echo RED.

## Retrospective

To be completed before review. This section will identify the landed resource
digests, executable witnesses, any deviation from the planned corpus, and the
remaining gap before Echo can admit and execute the Jedit-owned program.
