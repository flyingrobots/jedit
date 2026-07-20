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
  [`native/jedit-echo-host/src/records.rs#L150:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/records.rs#L150)
  [`native/jedit-echo-host/src/identity.rs#L6:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/identity.rs#L6)
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
  [`native/jedit-echo-host/src/rope/tree.rs#L69:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/rope/tree.rs#L69)
  [`native/jedit-echo-host/src/rope/tree.rs#L148:c70e12d73b4b00bc92412bab67e1761f7dd22f82`](https://github.com/flyingrobots/jedit/blob/c70e12d73b4b00bc92412bab67e1761f7dd22f82/native/jedit-echo-host/src/rope/tree.rs#L148)
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
- a corpus-only `u64` invocation schema plus exact compact invocation bytes;
- an explicit no-edge posture for version 1;
- explicit exclusion and migration posture for TypeScript-only propositions;
- deterministic success cases for insertion, deletion, Unicode replacement,
  cross-leaf replacement, and replacement larger than one leaf;
- deterministic obstruction cases for stale basis, malformed/out-of-bounds
  range, invalid UTF-8 boundary, no-op, and arithmetic overflow;
- an exhaustive semantic-obstruction enum plus strict machine-readable corpus,
  terminal, footprint, patch, and result shapes;
- exact committed initial graph, invocation, read/write support, ordered patch,
  result, and obstruction evidence for each case;
- fail-closed basis Head content-address and target-Buffer relationship checks
  in both production planning and the structurally separate consequence gate;
- byte-for-byte regeneration tests and checked SHA-256 resource digests.

## Non-Goals

This cycle does not include:

- an Echo operation-program or production invocation ABI or evaluator;
- an Edict target lowerer, package, or generated client;
- production command routing, fact-byte encodings, or identity algorithms;
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

Before `ReplaceRange` interprets fields from the Buffer-selected basis Head, the
retained Head bytes must reproduce that exact content-addressed node ID; the
authenticated Head must then name the same target Buffer. The structurally
separate retained-consequence gate checks those two propositions again before it
accepts committable evidence.

Canonical fact JSON is:

- UTF-8 with no byte-order mark or insignificant whitespace;
- one object whose fields occur in declaration order;
- decimal unsigned integers with no leading zeroes;
- exact `null` for absent optional identifiers;
- 32-byte identifiers and digests encoded as arrays of 32 decimal octets;
- byte strings encoded as arrays of decimal octets;
- JSON strings encoded by the exact `jedit.compact-serde-json.v1` law below;
- no maps, floats, signed integers, duplicate members, or unknown members.

The string law emits quotation mark and reverse solidus as `\"` and `\\`.
U+0008, U+0009, U+000A, U+000C, and U+000D use `\b`, `\t`, `\n`, `\f`, and
`\r`. Every other scalar from U+0000 through U+001F uses six bytes
`\u00xx`, with lowercase hexadecimal. Solidus is never escaped. Every other
Unicode scalar from U+0020 through U+10FFFF is emitted as its literal UTF-8
bytes; surrogate escapes are forbidden. These rules apply to member names and
string values. Maps are forbidden as canonical fact fields at every nesting
depth, even if an implementation uses a map internally. The schema's golden
vector covers every control scalar plus quotation mark, reverse solidus,
solidus, non-ASCII text, U+2028, and U+2029.

This is a writer and identity law. The generic legacy `serde_json` reader
accepts some noncanonical spellings, and not every retained-content consumer
recomputes node identifiers from attachment bytes. Production `ReplaceRange`
now routes its selected basis Head through the strict reader described above;
other compatibility readers do not yet enforce the complete version-1
contract. Future package validation and Echo evaluation must reject every
noncanonical or misaddressed fact.

Content-addressed identifiers are BLAKE3-256 over the exact declared domain
bytes followed by canonical fact bytes. Buffer identifiers, Blob content
hashes, and empty-root digests use their separately declared BLAKE3 domains.
The generic content-fact constructor does not accept Buffer facts. This removes
the currently representable but unused `BufferFact` content identity while
preserving every production byte and authoritative keyed Buffer identifier.

The normative identity domains are:

| Identity | Exact UTF-8 domain | Lowercase hexadecimal domain | Material |
| --- | --- | --- | --- |
| Type ID | `type:` | `747970653a` | type-label UTF-8 |
| Buffer node | `jedit.text.buffer-key.v1\0` | `6a656469742e746578742e6275666665722d6b65792e763100` | buffer-key UTF-8 |
| Blob fact | `jedit.text.blob.v1\0` | `6a656469742e746578742e626c6f622e763100` | canonical Blob bytes |
| Leaf fact | `jedit.text.leaf.v1\0` | `6a656469742e746578742e6c6561662e763100` | canonical Leaf bytes |
| Branch fact | `jedit.text.branch.v1\0` | `6a656469742e746578742e6272616e63682e763100` | canonical Branch bytes |
| Head fact | `jedit.text.head.v1\0` | `6a656469742e746578742e686561642e763100` | canonical Head bytes |
| Rewrite fact | `jedit.text.rewrite.v1\0` | `6a656469742e746578742e726577726974652e763100` | canonical Rewrite bytes |
| Diff fact | `jedit.text.diff.v1\0` | `6a656469742e746578742e646966662e763100` | canonical Diff bytes |
| Blob content | `jedit.text.blob-content.v1\0` | `6a656469742e746578742e626c6f622d636f6e74656e742e763100` | blob bytes |
| Empty-root digest | `jedit.text.empty-root.v1\0` | `6a656469742e746578742e656d7074792d726f6f742e763100` | empty bytes |

Every row hashes raw `domain || material`, with no inserted delimiter or length
prefix. The terminal NUL shown in most domains is itself the final domain byte.

The finite corpus uses
`jedit.text.ReplaceRange.oracle-invocation@1`, a compact UTF-8 JSON object with
ordered members `bufferId`, `basisHeadId`, `startByte`, `endByte`, and
`replacementUtf8Hex`. Identifiers are 64 lowercase hexadecimal characters;
coordinates are JSON decimal `u64`; replacement bytes are lowercase
hexadecimal and must decode as UTF-8. Every case carries the exact compact
object bytes in `invocationBytesHex`. This schema is a conformance input, not a
runtime authority or a prematurely frozen Echo ABI. Strict corpus conformance
rejects uppercase, nonhexadecimal, short, or long identifiers; odd-length or
nonhexadecimal replacement bytes; replacement bytes that are not UTF-8; and
coordinates that are not JSON `u64` values.

The native planner and retained fact coordinates are `u64`, and the future
Edict-authored operation must preserve that domain. Current production still
routes `ReplaceRangeAsTickInput` through the Wesley/GraphQL compatibility ABI,
where `startByte` and `endByte` are `i32` and `bounded_i32` rejects values above
`i32::MAX`. The above-GraphQL-range oracle intentionally bypasses that legacy
ABI and proves only the planner and future-operation coordinate law. This cycle
therefore preserves current production behavior while leaving #285 open until
the Edict cutover removes the narrowing boundary.

The oracle resource is finite conformance evidence. It does not prove semantic
equivalence for every possible `ReplaceRange` input. Its legacy planner path
must not invoke, link, or share an evaluator implementation with the future
Echo operation program. Sharing the published fact schema and comparison codec
is disclosed and expected.

The declaration's `oracleCorpus` section freezes the exact envelope, case,
basis-fact, terminal, footprint, patch, and result member sets. Its obstruction
domain is an exhaustive generated Rust enum whose ten kebab-case values are
also enumerated in the machine declaration. A structurally separate
conformance validator rejects unknown members, terminal and patch variants,
and semantic obstruction codes before an external consumer compares evidence.
Every flattened local identifier in footprint or patch evidence is qualified by
the corpus's top-level `warpId`; generation and local application reject a key
whose WARP differs before discarding that redundant qualifier.

Before a committable case is serialized, the oracle separately decodes the
post-patch Buffer, Head, Rewrite, and Diff facts through a structurally separate
gate using Jedit's production codec. That gate checks their identities, basis,
range, next head, version, sequence, lengths, root digest, and cross-links
against one another and the planner summary. Result evidence is derived from
those validated retained facts and materialized text, not from an unchecked mix
of planner summaries and discovered type labels.

## Lower Modes

The contract is entirely headless. `cargo test` recomputes and compares the
resources. `npm run lawpack:replace-range:update` deliberately replaces all
three resources and their SHA-256 sidecars, then reruns check mode. Each
resource and sidecar replacement is an atomic same-directory rename; CI never
sets either update variable. Any present update variable other than exact `1`
fails. Malformed resources fail with ordinary test errors; there is no fallback
to source-code inference.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | Existing native production fact types and `plan_replace` semantics at the merge target. |
| Derived state | Machine-readable schema and finite golden corpus. |
| Invalid states | Noncanonical fact bytes, wrong domains or identities, schema drift, corpus drift, or ambiguous native/TypeScript ownership. |
| Reset behavior | Fixtures regenerate from a clean synthetic graph; no production WAL or user data is read. |
| Serialization | Digest-locked JSON resources containing exact fact bytes as lowercase hexadecimal. |
| Deterministic assumptions | Ordered Rust structs, no map-valued fact fields, exact domain bytes, explicit UTF-8 inputs, no clock/randomness/host paths. |

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
the product or scraping Rust debug output. Successful cases name exact basis,
input, support, patch, retained facts, and result. Obstructed cases name exact
basis, input, typed obstruction, no-plan posture, and unchanged-parent evidence.
Every case also names its semantic purpose and terminal posture. The
`semanticBaselineCommit` names the historical checkpoint whose behavior this
cycle freezes; the `sourceSet` digest binds the exact declared generating
source bytes. The evidence grade prevents a consumer from mistaking
finite-corpus agreement for formal equivalence.

## Linked Invariants

- Jedit owns product semantics and canonical application schemas.
- Echo owns runtime admission, execution, commitment, receipts, and recovery.
- Edict artifacts do not prove that Echo executed them.
- A resource digest supplies substitution evidence, not authority.
- Native facts and the future operation use `u64`; the current compatibility
  ABI remains an explicitly documented `i32` limitation.
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

## Decision

Freeze native JSON version 1 and a finite differential corpus. This preserves
current production history and gives the next Echo slice exact inputs and
outputs. It is intentionally conservative: structural graph schema evolution
can proceed later under a new coordinate and explicit migration.

## Implementation Slices

- [x] Slice 1: land this decision record and freeze the executable witnesses.
- [x] Slice 2: publish and byte-lock `jedit.text.schema@1`.
- [x] Slice 3: publish and regenerate the `ReplaceRange` differential corpus.
- [x] Slice 4: close schema/corpus review gaps and complete cycle evidence.

## Tests To Write First

- [x] Schema resource test: regenerate exact bytes, verify the checked SHA-256
      digest, and reject drift from native fact labels, field order, domains,
      attachment posture, and excluded propositions.
- [x] Type-law test: prove Buffer has no generic content-addressed constructor
      while every immutable ReplaceRange fact retains its existing identifier.
- [x] Schema/writer conformance test: compare every declared field sequence with
      the order observed directly from native canonical fact bytes.
- [x] Success corpus test: regenerate each initial graph and replacement plan,
      then compare exact reads, writes, patch order, fact bytes, identities,
      result metrics, and preserved facts.
- [x] Obstruction corpus test: regenerate each failure, compare its Jedit-owned
      semantic category and legacy evidence, and prove no write plan exists.
- [x] Determinism test: regenerate the complete resources twice from fresh
      synthetic graphs and compare exact bytes.
- [x] Fixed-width test: retain `u64` values above GraphQL/i32 range in the
      corpus invocation and its exact compact bytes without narrowing.

## Acceptance Criteria

The work is done when:

- [x] Issue #292 remains the live cycle ledger.
- [x] The declaration selects the native production model unambiguously.
- [x] All seven ReplaceRange fact shapes and identity domains are explicit.
- [x] TypeScript-only propositions and migration posture are explicit.
- [x] Schema and corpus resource digests are checked from exact bytes.
- [x] The corpus covers representative persistent-rope successes and typed
      obstructions.
- [x] Valid-input production consequences, fact bytes, authoritative identities,
      Echo dependency, and user-visible behavior remain unchanged; malformed,
      noncanonical, or misaddressed selected basis Heads now fail closed before
      a `MutationPlan` is constructed.
- [x] Focused Rust tests and `npm run check` pass.
- [x] The retrospective records evidence limits and the exact next Echo RED.

## Validation Plan

```bash
npm ci
npm run lawpack:replace-range:update
cargo test --manifest-path native/jedit-echo-host/Cargo.toml \
  --test replace_range_schema
cargo test --manifest-path native/jedit-echo-host/Cargo.toml \
  --test replace_range_schema_conformance
cargo test --manifest-path native/jedit-echo-host/Cargo.toml \
  --test replace_range_oracle
cargo clippy --manifest-path native/jedit-echo-host/Cargo.toml \
  --all-targets -- -D warnings
npm run check
node scripts/jedit-production-cutover-guard.mjs
npm run witness:echo
```

`cargo fmt --check` reports two pre-existing differences on `origin/main`.
This branch formats the semantically changed `src/rope/window.rs`; only the
unchanged `src/contract.rs` baseline difference remains. The cycle does not mix
that unrelated base cleanup into its semantic diff.

## Playback / Witness

Run `npm run lawpack:replace-range:update` from a clean checkout. It rebuilds
the declaration, codec vectors, corpus, and all sidecars, then proves check mode
is clean. Inspect
`contracts/jedit/lawpacks/replace-range-v1/text-schema-v1.json` for the exact
fact, string, identity, rope, and corpus-invocation laws. Inspect
`replace-range-v1.oracle.json` for 28 self-contained cases with basis facts,
exact invocation bytes, support, ordered patches, results, or typed no-patch
obstructions. No editor, terminal rendering, external service, or sibling
checkout is required.

## Risks

Known risks:

- The corpus is finite and does not prove all-input semantic equivalence.
- The legacy reader accepts noncanonical JSON that the writer never emits.
- The current Wesley/GraphQL invocation remains limited to `i32` coordinates.
- A source change outside the declared oracle source set could still affect
  behavior through a dependency selected by the bound Cargo manifest and
  lockfile.

Mitigations:

- Evidence is graded deterministic self-validation until Echo #684 supplies a
  separately implemented evaluator and finite-corpus comparison.
- The declaration makes canonical writer bytes and corpus shapes normative and
  requires the new evaluator to reject noncanonical or misaddressed facts.
- Jedit #285 remains open for the production cutover; this PR does not claim the
  compatibility ABI has changed.
- The corpus binds the exact native Cargo manifest and lockfile together with
  the Jedit planner, record, identity, error, window, case generator, basis
  builder, and source-set framing bytes. CI preserves the bound dependency
  selection while separately compiled Echo evidence remains the independence
  boundary.

## Follow-On Debt

- [Echo #684](https://github.com/flyingrobots/echo/issues/684) must add the
  callback-free bounded declarative graph-operation evaluator and consume these
  exact resources in its first RED.
- [Jedit #285](https://github.com/flyingrobots/jedit/issues/285) remains open
  until production `ReplaceRange` leaves the GraphQL `Int` compatibility ABI.

## Retrospective

What changed from the design:

- **Native schema corpus.** Native oracle generation runs the same case set
  twice, requires byte-identical output, compares those bytes with the
  committed oracle resource, and checks its SHA-256 sidecar.
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L22@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L22)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L23@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L23)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L24@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L24)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L30@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L30)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L31@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L31)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L35@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L35)
- **Retained stale-basis relationship.** The stale fixture retains the invoked
  historical Head and checks its relationship to the current canonical Head.
  [`native/jedit-echo-host/tests/support/replace_range_basis_witness.rs#L59@d57e0d239c005898839a15041807580ed2dfe595`](https://github.com/flyingrobots/jedit/blob/d57e0d239c005898839a15041807580ed2dfe595/native/jedit-echo-host/tests/support/replace_range_basis_witness.rs#L59)
- **Retained foreign-basis relationship.** The foreign fixture retains another
  Buffer and checks that it canonically names the invoked foreign Head.
  [`native/jedit-echo-host/tests/support/replace_range_basis_witness.rs#L68@d57e0d239c005898839a15041807580ed2dfe595`](https://github.com/flyingrobots/jedit/blob/d57e0d239c005898839a15041807580ed2dfe595/native/jedit-echo-host/tests/support/replace_range_basis_witness.rs#L68)
- **Schema and source-set contract.** Schema conformance mechanically compares
  every declared fact-member order with canonical native-writer bytes. The
  source-set implementation embeds an ordered path/byte list and hashes it
  with domain-separated, length-framed SHA-256.
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L86@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L86)
  [`native/jedit-echo-host/tests/support/replace_range_source_set.rs#L5@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/support/replace_range_source_set.rs#L5)
  [`native/jedit-echo-host/tests/support/replace_range_source_set.rs#L70@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/support/replace_range_source_set.rs#L70)
- **Obstruction schema.** Oracle support declares a closed ten-variant serde
  obstruction enum and matching `ALL` list. Schema conformance freezes the same
  ten wire values, while negative witnesses reject an unknown top-level member
  and an invented semantic code.
  [`native/jedit-echo-host/tests/support/replace_range_contract.rs#L3@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/support/replace_range_contract.rs#L3)
  [`native/jedit-echo-host/tests/support/replace_range_contract.rs#L20@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/support/replace_range_contract.rs#L20)
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L336@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L336)
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L362@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L362)
- **Artifact digest ledger.** The published SHA-256 digests are
  `fa5087c8fe72dc9c5f138f12b9498ab7f943061fc5ca735d4f68009c081eabc2`
  for the schema,
  `1ac26477e1d6c08df49446627ad002e40bd214235ce93b563d62bb50e40dc14c`
  for codec vectors, and
  `199ee252f47c1ac6045ac868ae41311c4a95c6654bd0c78d66ac766a8abd4a66`
  for the oracle. The oracle source-set digest is
  `821e9cd48c759c116ef5b1d554ab5636079a98582d7584066acc0384ca93d28a`.
  The ledger derives all four values from the committed artifacts.
  [`tests/replace-range-law-cycle.spec.mjs#L76@95f63d2c31847c3a4cc4bbea9152900470843d3a`](https://github.com/flyingrobots/jedit/blob/95f63d2c31847c3a4cc4bbea9152900470843d3a/tests/replace-range-law-cycle.spec.mjs#L76)
- **Serialized resource updates.** The deliberate resource-update command runs
  each exact writer serially
  before the complete locked reader and conformance pass.
  [`package.json#L10@13b16f2e7195458138865460c5948744ea8615ed`](https://github.com/flyingrobots/jedit/blob/13b16f2e7195458138865460c5948744ea8615ed/package.json#L10)
- **Exact audit locations.** The earlier audit gate declared nine evidence
  class/full-commit/path/line tuples and required each corresponding GitHub
  blob URL to occur somewhere in the retrospective.
  [`tests/replace-range-law-cycle.spec.mjs#L32@a8cabbd8d68c5345cdea5cba0bb59b956ec7be63`](https://github.com/flyingrobots/jedit/blob/a8cabbd8d68c5345cdea5cba0bb59b956ec7be63/tests/replace-range-law-cycle.spec.mjs#L32)
  [`tests/replace-range-law-cycle.spec.mjs#L110@a8cabbd8d68c5345cdea5cba0bb59b956ec7be63`](https://github.com/flyingrobots/jedit/blob/a8cabbd8d68c5345cdea5cba0bb59b956ec7be63/tests/replace-range-law-cycle.spec.mjs#L110)

What the tests proved:

- **Native serialization.** Native Rust reconstructs the schema and
  codec-vector resources, requires byte-for-byte equality with both committed
  resources, checks their SHA-256 sidecars, and compares every declared
  fact-member order with canonical native-writer bytes.
  [`native/jedit-echo-host/tests/replace_range_schema.rs#L89@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_schema.rs#L89)
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L86@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L86)
- **Supplementary Unicode scalar.** The golden vector requires U+10FFFF to
  remain literal four-byte UTF-8 and rejects surrogate-style canonical output.
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L290@79a3b788d102c0b04fb47c1d3ce972dbab32a1cc`](https://github.com/flyingrobots/jedit/blob/79a3b788d102c0b04fb47c1d3ce972dbab32a1cc/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L290)
- **Type-ID domain binding.** Conformance recomputes every declared fact type ID
  from the published domain and compares it with pinned `warp-core` behavior.
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L308@f5482c4e7797e043c006adf1de293d4dfe85e13a`](https://github.com/flyingrobots/jedit/blob/f5482c4e7797e043c006adf1de293d4dfe85e13a/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L308)
- **Strict typed corpus validation.** Strict conformance rejects drift in the
  envelope identity and ordered source-set claim.
  [`native/jedit-echo-host/tests/replace_range_corpus_conformance.rs#L120@9a309641edd4b809c37f5d055790de311e5d61f9`](https://github.com/flyingrobots/jedit/blob/9a309641edd4b809c37f5d055790de311e5d61f9/native/jedit-echo-host/tests/replace_range_corpus_conformance.rs#L120)
- **Canonical oracle bytes.** Raw-byte validation separately freezes canonical
  object order, whitespace, framing, and terminal newline.
  [`native/jedit-echo-host/tests/replace_range_corpus_conformance.rs#L70@8112752b85862d065811fbe133fdfe8f9e8021c1`](https://github.com/flyingrobots/jedit/blob/8112752b85862d065811fbe133fdfe8f9e8021c1/native/jedit-echo-host/tests/replace_range_corpus_conformance.rs#L70)
- **WARP-qualified identifiers.** Footprint and patch projections refuse a
  foreign WARP instead of flattening its local IDs into the corpus WARP.
  [`native/jedit-echo-host/tests/support/replace_range_oracle.rs#L393@edd41a35058fea354d46a38421641b0c173e3faa`](https://github.com/flyingrobots/jedit/blob/edd41a35058fea354d46a38421641b0c173e3faa/native/jedit-echo-host/tests/support/replace_range_oracle.rs#L393)
- **Invocation lexical validation.** Corpus invocation conformance rejects
  identifiers and replacement bytes that
  violate their exact lowercase hexadecimal, width, or UTF-8 lexical laws.
  [`native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L396@c0214b2fe52ef3a3cb2d09e24af9cd4a3258ca0c`](https://github.com/flyingrobots/jedit/blob/c0214b2fe52ef3a3cb2d09e24af9cd4a3258ca0c/native/jedit-echo-host/tests/replace_range_schema_conformance.rs#L396)
- **Typed planner obstructions.** Production owns the closed operation reason,
  exhaustively maps structural rope faults into it, and returns typed failures
  from the detailed planner. The compatibility wrapper retains the legacy
  `HostError`, and corpus parity re-runs that wrapper to compare legacy class,
  message, and display.
  [`native/jedit-echo-host/src/rope/replace.rs#L14@b4606ce74ab37f8cc54d184a17c8eaeea2dff092`](https://github.com/flyingrobots/jedit/blob/b4606ce74ab37f8cc54d184a17c8eaeea2dff092/native/jedit-echo-host/src/rope/replace.rs#L14)
  [`native/jedit-echo-host/src/rope/replace.rs#L72@b4606ce74ab37f8cc54d184a17c8eaeea2dff092`](https://github.com/flyingrobots/jedit/blob/b4606ce74ab37f8cc54d184a17c8eaeea2dff092/native/jedit-echo-host/src/rope/replace.rs#L72)
  [`native/jedit-echo-host/src/rope/replace.rs#L99@b4606ce74ab37f8cc54d184a17c8eaeea2dff092`](https://github.com/flyingrobots/jedit/blob/b4606ce74ab37f8cc54d184a17c8eaeea2dff092/native/jedit-echo-host/src/rope/replace.rs#L99)
  [`native/jedit-echo-host/src/rope/replace.rs#L118@b4606ce74ab37f8cc54d184a17c8eaeea2dff092`](https://github.com/flyingrobots/jedit/blob/b4606ce74ab37f8cc54d184a17c8eaeea2dff092/native/jedit-echo-host/src/rope/replace.rs#L118)
  [`native/jedit-echo-host/tests/support/replace_range_legacy.rs#L15@b4606ce74ab37f8cc54d184a17c8eaeea2dff092`](https://github.com/flyingrobots/jedit/blob/b4606ce74ab37f8cc54d184a17c8eaeea2dff092/native/jedit-echo-host/tests/support/replace_range_legacy.rs#L15)
- **Retained arithmetic refusal.** Checked helpers turn overflow into the typed
  structural arithmetic fault. Named retained-rope fixtures exercise the path,
  and corpus evaluation compares each observed reason with its expectation
  while asserting that planning leaves the basis-store projection unchanged.
  [`native/jedit-echo-host/src/rope/fault.rs#L59@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/src/rope/fault.rs#L59)
  [`native/jedit-echo-host/src/rope/fault.rs#L66@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/src/rope/fault.rs#L66)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L310@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/tests/replace_range_oracle.rs#L310)
  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L387@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/tests/replace_range_oracle.rs#L387)
  [`native/jedit-echo-host/tests/support/replace_range_oracle.rs#L214@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/tests/support/replace_range_oracle.rs#L214)
  [`native/jedit-echo-host/tests/support/replace_range_oracle.rs#L223@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/tests/support/replace_range_oracle.rs#L223)
  [`native/jedit-echo-host/tests/support/replace_range_oracle.rs#L246@9930d04bed048d69f54ef08d5f25f5c211efa199`](https://github.com/flyingrobots/jedit/blob/9930d04bed048d69f54ef08d5f25f5c211efa199/native/jedit-echo-host/tests/support/replace_range_oracle.rs#L246)
- **Declared-text consequence.** Successful projection independently derives
  basis prefix plus replacement plus suffix and rejects an internally
  consistent retained rope that does not realize that declared edit.
  [`native/jedit-echo-host/tests/support/replace_range_oracle.rs#L316@afd06f652aad7d6e8f389efec49e1ea1469eef88`](https://github.com/flyingrobots/jedit/blob/afd06f652aad7d6e8f389efec49e1ea1469eef88/native/jedit-echo-host/tests/support/replace_range_oracle.rs#L316)
- **Keyed Buffer identity.** Retained-consequence validation recomputes the
  keyed Buffer address from `buffer_key` in both basis and result graphs.
  [`native/jedit-echo-host/tests/support/replace_range_consequence.rs#L42@751ea54360f2633ee04f472bb18ad07c47cef61f`](https://github.com/flyingrobots/jedit/blob/751ea54360f2633ee04f472bb18ad07c47cef61f/native/jedit-echo-host/tests/support/replace_range_consequence.rs#L42)
- **Current-patch consequence selection.** Rewrite and Diff evidence is selected
  from the current patch and cross-linked before a committable result enters the
  corpus.
  [`native/jedit-echo-host/tests/support/replace_range_consequence.rs#L113@475b6dcc0eae9edbf228221069ab3aab975be868`](https://github.com/flyingrobots/jedit/blob/475b6dcc0eae9edbf228221069ab3aab975be868/native/jedit-echo-host/tests/support/replace_range_consequence.rs#L113)
- **Retained node-record typing.** Every retained fact requires agreement
  between the graph node record and atom attachment type before decoding.
  [`native/jedit-echo-host/tests/support/replace_range_consequence.rs#L242@6c20d93ff94a8b0e24e6d3fc05492f99f27a56e8`](https://github.com/flyingrobots/jedit/blob/6c20d93ff94a8b0e24e6d3fc05492f99f27a56e8/native/jedit-echo-host/tests/support/replace_range_consequence.rs#L242)
- **Evidence-grade boundary.** The corpus explicitly calls itself deterministic
  self-validation. It is not an independent verifier, all-input equivalence
  proof, Echo admission witness, runtime receipt, WAL, or recovery witness.
  [`native/jedit-echo-host/tests/support/replace_range_oracle.rs#L177@d87e7a1891cbefb6cf478bbc9b6a9ed87121b242`](https://github.com/flyingrobots/jedit/blob/d87e7a1891cbefb6cf478bbc9b6a9ed87121b242/native/jedit-echo-host/tests/support/replace_range_oracle.rs#L177)

What remains open:

- The exact next RED is Echo #684: load these pinned bytes as an external
  consumer and fail because the current operation interpreter supports only its
  tiny compare-and-set program. GREEN must come from a generic data-only bounded
  evaluator, never a Jedit planner callback, native rope intrinsic, or
  caller-supplied patch.
- Edict binding, Echo execution/receipt/recovery, Jim invocation, legacy
  `ReplaceRange` cutover, and full `u64` production support remain later
  campaigns.

PR:

- https://github.com/flyingrobots/jedit/pull/293
