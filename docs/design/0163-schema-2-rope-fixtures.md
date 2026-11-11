---
title: "DL-0163 - Executable Schema-2 Rope Fixtures"
legend: "DL"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/389"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-11-10"
updated: "2026-11-10"
---

# DL-0163 - Executable Schema-2 Rope Fixtures

## Linked Issue

- [Jedit #389](https://github.com/flyingrobots/jedit/issues/389)
- Owner of the register and its counterpart decisions:
  [DL-0159](0159-edict-rope-representation.md#replacerange-acceptance-across-representations)
- Final acceptance owner: [Jedit #296](https://github.com/flyingrobots/jedit/issues/296)

## Decision Summary

Publish one machine-readable schema-2 acceptance artifact that gives every one
of the 40 retained `jedit.text.ReplaceRange.oracle@1` ids an independently
specified schema-2 fixture and expected result, plus schema-2-only additions.
Every row names its retained `semanticCode`, its DL-0159 mapping, its schema-2
typed outcome, the boundary that decides it, and the precedence of every check
that could also reject it. Committable rows carry exact canonical facts, typed
edges, `ContentAddressV1` ids, reachability, path-copy sharing, read and write
footprints, normalized effects and checked counters. A test validates the
artifact against the frozen schema-1 oracle, Echo's published identity vectors
and an independent BLAKE3/CBOR implementation. Every row stays **unexecuted**:
nothing here claims that the rope runs.

## Sponsored Human

The Jim maintainer wants to know exactly what the authored rope must produce
for each retained case, so that #296 cannot close on text agreement, a generic
refusal or a resource exclusion.

## Sponsored Agent

An implementation agent needs per-case schema-2 inputs and exact expected graph
consequences it can compare against Echo receipts, without decoding schema-1
JSON facts or running the native planner.

## Hill

A reviewer can read one artifact and its validation test and see, for every
retained id, the schema-2 basis graph, the invocation, and either the exact
committed graph consequence or the typed obstruction with its boundary and
precedence, and can see that none of it was computed by the code it judges.

## Current Truth

- The retained oracle
  `contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.json`
  (sha256 `89a15993…`, pinned by its sidecar) has 40 cases: 6 committable and 34
  obstructed. Its physical expectations are schema-1 only.
- DL-0159 at `5f8c44b0` maps those 40 ids to 28 `carry` and 12 `counterpart`
  obligations, all unproved, and owns their decisions.
- No `jedit.text@2` lawpack exists (Jedit #296, inventory at `d8915f3e`), so
  schema-2 type ids, atom type ids and the authored outcome enum are not yet
  published by a compiler.
- Echo `e5604e0c` implements `ContentAddressV1` in
  `crates/warp-core/src/content_address_v1.rs` and freezes six vectors in
  `crates/warp-core/tests/content_address_v1_tests.rs`. Effects sort by slot
  class and id (`docs/architecture/authored-operation-effects.md`).
- The worldline-root-to-Buffer layout is unresolved (echo#927); the bounded
  closure selector is in progress (echo#926).

## Problem

The register says which obligations exist, not what satisfies them. Without
explicit fixtures, an implementation could be graded against its own output,
against text alone, or against a refusal raised at an unrelated boundary.

## Scope

- One versioned artifact covering all 40 ids exactly once, plus additions:
  positive shared Head, equal-content leaves, constructor leaf counts,
  invalid replacement bytes, and missing, duplicate or wrong-type edges.
- A fixture profile that declares every input the expectations depend on:
  warp id, type labels, atom codec, identity law, outcome vocabulary,
  boundaries, check precedence, reconstruction profile and footprint model.
- Counterpart decisions for all 12 counterpart rows, recorded in DL-0159.
- A test that validates the artifact without executing any rope.

## Non-Goals

Changing the schema-1 oracle; executing the operation; Echo admission runs;
observer cutover; file crossing; measuring the resource envelope; exposing
identity to authored source (Amblicit #260).

## User Experience / Product Shape

Developer-facing artifact and test only; no product surface changes.

### User Journey

Open the artifact → find a retained id → read its fixture and expected result
→ compare with an execution's receipt once #296 produces one.

### Wide UI Mockup

Not applicable: no rendered interface changes.

### Narrow UI Mockup

Not applicable: no rendered interface changes.

### Accessibility Considerations

Plain JSON and test output; no visual-only information.

## Runtime / API Contract

The artifact is data. Nothing in production reads it. Its validation test is
the only executable consumer until #296 supplies a runner. A runner may accept
a persistent-rope row only when the observed outcome, graph consequence,
footprint, effects, counters and evidence all match; text equality, a generic
refusal, a resource refusal or a Reference-target pass never does.

## Lower Modes

The artifact is canonical JSON with a SHA-256 sidecar.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | Hand-written fixture definitions and the fixture profile |
| Derived state | Ids, atoms, footprints and effects computed by an independent specification model |
| Invalid states | Missing or duplicate retained id, semanticCode drift, unbound obstruction, shape without physical expectations |
| Reset behavior | Regeneration is reviewed; the frozen bytes change only with a reviewed diff |
| Serialization | JSON; atoms as canonical CBOR hex; ids as lowercase hex |
| Determinism | No clock, randomness or environment input |

### Fixture profile decisions

- **Ids.** `ContentAddressV1` exactly as Echo defines it. Warp id, node type
  ids, atom type ids and edge type ids are BLAKE3 over `warp:` or `type:` and a
  declared label, as Echo's `make_warp_id` and `make_type_id` do. `BufferId` is
  BLAKE3 over `jedit.text.buffer-key.v2\0` and the key. These labels are
  fixture-declared until the `jedit.text@2` lawpack publishes its own; a
  different published label set regenerates the ids under review, never to
  match an output.
- **Atoms.** `edict.canonical-cbor/v1` maps keyed by field name; integers are
  unsigned, bytes are byte strings, strings are text strings.
- **Rope law.** Leaf height 1; branch height `1 + max(children)`, AVL. Leaves
  hold 1–4096 bytes of valid UTF-8. `fromBytes` splits at the last character
  boundary at or before the midpoint. An edit inside one leaf whose result is
  1–4096 bytes rewrites that leaf and path-copies its ancestors; any other edit
  is prefix, `fromBytes(replacement)`, suffix, joined by AVL concatenation.
- **Read and write sets.** The specification model reads through a recording
  view; the expected read set is the program's witnessed reads: node records
  and atoms, and outgoing edge ranges by `(source, type)`. Echo's own
  validation and precondition reads are not listed. The write set follows
  Echo's slot model, including the range key of each written edge. Validation
  is top-down: a branch's sum, height and identity are checked from its
  children's claimed atoms before descending, and every node the operation
  resolves, including those the reconstruction and no-op comparison read, is
  validated before any endpoint is classified.
- **Competing checks.** A row may name later checks its fixture also fails;
  each is verified by re-running the model with the deciding check passed.
- **Outcomes, boundaries and precedence.** Checks run in a fixed order: Buffer
  presence, Buffer decode, basis, range order, replacement validity, envelope,
  Head decode, range bounds against the Head, closure validation, character
  boundaries, no-op, counters. The first failing check decides. Echo admission
  is a separate boundary for proposals and for negative admission witnesses.

## Accessibility Posture

Not applicable: no product surface.

## Localization / Directionality Posture

Text is UTF-8 bytes without normalization; fixtures include multibyte text.

## Agent Inspectability / Explainability Posture

Every row is keyed by its retained id and names its oracle (specified text,
derived ids, or declared profile), so an agent can check a result without
trusting prose.

## Linked Invariants

- [DL-0159](0159-edict-rope-representation.md): register, identity law,
  representation gate.
- [Documentation lifecycle](../method/documentation-lifecycle.md): the test
  reads artifacts, never this document.

## Design Alternatives Considered

### Option A: Run the native planner on schema-2 inputs

Rejected: the expectations would come from the code they judge.

### Option B: Exact physical expectations only where the shape is forced

Rejected: cross-leaf and constructor rows would stay unpinned, and the register
asks for exact footprints and sharing.

### Option C: A declared specification model

Chosen. A small model, independent of the native planner and of authored
source, computes the shapes the profile declares; the test checks those shapes
against hand-specified text and invariants.

## Decision

Option C, with all profile choices recorded above and in the artifact.

## Implementation Slices

- [x] Slice 1: Independent BLAKE3, canonical CBOR and `ContentAddressV1`,
  checked against reference vectors.
- [x] Slice 2: Fixture profile, specification model and the 40 retained rows.
- [x] Slice 3: Schema-2 additions, the artifact, its sidecar and validation.
- [ ] Slice 4: DL-0159 counterpart decisions; CI and independent review.

## Tests To Write First

- [x] The artifact covers every retained id exactly once with DL-0159's mapping.
- [x] Each obstructed row binds the oracle's semanticCode, a typed outcome, a
  boundary and a precedence list that ends at its deciding check.
- [x] Text-only, generic-refusal, resource-refusal and Reference-only
  observations never satisfy a persistent row.
- [x] Ids and atoms recompute from their preimages; hashing matches Echo's
  frozen vectors and the BLAKE3 reference crate.
- [x] The schema-1 oracle bytes are unchanged.

## Acceptance Criteria

- [x] All 40 ids covered once; additions supplement them.
- [x] Persistent rows cannot pass on text, refusal class, resource exclusion
  or Reference evidence.
- [x] No expectation depends on the native planner or authored source.
- [x] Every moved obligation is recorded; nothing is dropped.

## Validation Plan

`node --test tests/replace-range-schema-2-fixtures.spec.mjs` validates the
artifact independently of its builder: it imports the BLAKE3 and
`ContentAddressV1` transcriptions and cbor-x, never the model or the rows.
`node tests/support/replace-range-schema-2/generate.mts --check` (also run by
that spec) proves the frozen bytes still follow from the rows; `--write`
regenerates them for review. Repository typecheck and quality gate run locally;
CI runs the shards.

## Playback / Witness

None: the artifact is not executed.

## Risks

- The reconstruction profile is normative for #296. If the authored rope needs
  a different shape, the fixture changes through review, never by regenerating
  from output.
- Fixture-declared type labels may differ from the published lawpack's.

## Follow-On Debt

- Exact closure selector (echo#926) and worldline-root layout (echo#927).
- Measured resource envelope; rows record their resource-domain needs.

## Retrospective

The artifact covers all 40 retained ids and 15 additions; every row stays
unexecuted and the passing count is still 0/40. The first green run caught a
hand-copied semanticCode error, which is why the validator reads the oracle
instead of trusting the rows. Keeping the validator free of builder imports
(and testing that) made it possible to say the expectations were not checked by
the code that produced them. The reconstruction profile is now normative for
#296: the authored rope must reproduce these shapes and reads, or the fixtures
change through review. Exact reads remain the specification model's until
echo#926 fixes a closure selector, and reachability starts at the Buffer until
echo#927 fixes the worldline-root layout.
