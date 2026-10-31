# ReplaceRange in Edict source: complete drafts

These files are the whole `ReplaceRange` program written the way it should
read, against the schema 2 representation in
[DL-0159](../../../docs/design/0159-edict-rope-representation.md). They are not
part of the application gate. The main Text/Reference/Rope/ReplaceRange drafts
do not compile yet; Boundary is a separately compiled and executed helper.
Their job is to let the program drive language and runtime work instead of
isolated probes.

| File | Target | Content |
| --- | --- | --- |
| `Boundary.edict` | shared | bounded character-boundary predicate, separately compiled and executed |
| `Text.edict` | shared | schema 2 facts, edge types, `ContentAddressV1` identity, text metrics |
| `Reference.edict` | 1: semantic correctness | flat-text `ReplaceRange`; deliberately inefficient |
| `Rope.edict` | 2: persistent rope | pure AVL split, join, balance, build, collect, normalize |
| `ReplaceRange.edict` | 2: persistent rope | closure read, pure replace, `ensure` effects, head retarget |

The two targets are separate on purpose. Target 1 needs almost no new language
and isolates the Echo effect bridge. Target 2 adds the language features a
persistent structure needs. Target 1 then serves as a differential oracle for
target 2: they must agree on logical text and outcomes, not physical roots.
That agreement is necessary, not sufficient: representation invariants and
admission and effect behavior are validated separately, because two programs
can agree on text while both emitting an invalid graph. Target 1 does not
complete the rope.

## Historical upstream result before module pinning

Measured again on 2026-10-30 with Amblicit (formerly Edict)
`980c3ae3ff2ef96a0d026f9afdd77d61758cd57c` and Echo
`9c32e0b5e633ca68383ef09b5da7a4bc2d6b8e9e`. The reproducible
[inventory runner and results](../../replace-range-probes/compiler-inventory/README.md)
retain the minimal construct probes, source hashes and structured diagnostics.

| Whole draft at that measurement | First refusal |
| --- | --- |
| `Text.edict` | parse: generic `fn contentId<T>` (`expected LParen, found Lt`) |
| `Reference.edict` | parse: its `use module` import omits the required digest |
| `Rope.edict` | parse: its `use module` import omits the required digest |
| `ReplaceRange.edict` | parse: its `use module` import omits the required digest |

The module refusals are draft syntax debt, not evidence that source modules
are unsupported. A minimal, digest-authenticated module passes public build
with Echo's explicit source-module publication. The default checked provider
package rejects Core function tables by schema; it must not be used to infer
that the compiler lacks source functions or modules.

Each whole draft stops at its first error. The isolated probes below distinguish
compiler refusals from provider refusals. An accepted public build includes
lowering and independent verification; it does not prove helper invocation,
rope execution, effects, admission, WAL, recovery or the final editor cutover.

## Unpublished byte-prerequisite candidate

A separate [candidate inventory](../../replace-range-probes/compiler-inventory/candidate-composed-bytes.json)
measures Amblicit `9b5ed1a` with Echo's composed byte-literal/U8/lookup candidate
`162d14a1`. These are local branches, not upstream main or promoted checked
components. The original upstream measurements below remain pinned to their
named commits.

The candidate clears the isolated raw-byte helper, U8, byte-lookup and composed
literal-plus-lookup probes. Together with the baseline, addition, count, UTF-8
and a digest-authenticated module, nine of 28 public builds pass. At that source revision, the whole
drafts failed first at the same generic helper or missing module digest listed
above. The follow-up below fixes the import syntax; the identity contract and
later rope constructs still need their own evidence.
No persistent-rope, effects or recovery acceptance follows from these probes.

## Authenticated imports before the boundary-helper extraction

The drafts now carry source-module digests derived from the exact imported
bytes. The inventory supplies Text to Reference and Rope, and Text plus Rope
to ReplaceRange, with each application's own coordinate. The
[authenticated-closure result](../../replace-range-probes/compiler-inventory/candidate-authenticated-drafts.json)
names compiler `9b5ed1a`, Echo witness revision `158714ce`, the unchanged selected
component hashes, and every source file's hash. The earlier measurements above
remain exact evidence for their original source revisions.

| Authored draft at that measurement | Next measured parse refusal |
| --- | --- |
| `Text.edict` | generic `contentId<T>` at line 89: expected `LParen`, found `Lt` |
| `Reference.edict` | read-expression obstruction at line 55: expected `RParen`, found `else` |
| `Rope.edict` | recursive depth clause at line 24: expected `Semi`, found `depth` |
| `ReplaceRange.edict` | enum declaration at line 49: expected `Semi`, found `LBrace` |

The module syntax debt is removed; these programs still do not compile. The
schema-2 lawpack and identity contract, later language constructs, and runtime
rope obligations remain open. See the inventory's
[repinning commands](../../replace-range-probes/compiler-inventory/README.md#authenticated-draft-source-closures)
after changing an imported draft. The current check verifies only the import
bytes, not the semantics or compilation of the imported program.

## Current character-boundary helper and remaining failures

The exact [Boundary module](Boundary.edict) is now independently buildable and
executed by the [public compiler/runtime witness](../../replace-range-probes/text-boundary/README.md).
Text delegates its boundary predicate to that digest-authenticated module.
The predicate is total on its bounded input: it safely handles empty input,
returns false beyond the end, and performs byte lookups only under strict
bounds. UTF-8 validity remains a separate rope invariant.

The [current complete-closure inventory](../../replace-range-probes/compiler-inventory/candidate-boundary-drafts.json)
retains nine of 28 accepted builds. Text still first refuses at the generic
`contentId<T>` helper, now line 90. Reference still refuses at the read
expression's `else` (55), Rope at `depth` (24), and ReplaceRange at its enum
(49). The new helper does not make the whole Text module compilable. Its 61
predicate cases are separate from the 40 full-operation oracle cases, and no
rope/effect/admission/recovery/editor acceptance is inferred.

## Variant declaration foundation

With local Amblicit `da86ed1`, the
[new candidate inventory](../../replace-range-probes/compiler-inventory/candidate-variant-types.json)
accepts ten of 28 public builds. The new accepted case declares an acyclic
variant with exact case names and payload references. The compiler preserves
that type graph in Core, and the current provider accepts the declaration.
The isolated probe does not construct or match a variant or execute
variant-valued data. Enum declarations, recursive variants, constructors and
matching remain open at that compiler revision, so the full rope's first
failures above are unchanged.

The later [constructor inventory](../../replace-range-probes/compiler-inventory/candidate-variant-constructors.json)
uses Amblicit `2e24840` and the unchanged Echo `158714ce` publication: ten of
30 public builds accept. A helper returning `Probe::Data(value)` now reaches
the provider's `core.source-functions` refusal; a Boolean payload for its U8
case refuses earlier with source `TypeMismatch`. These are distinct boundaries.
The valid helper is unused by the baseline operation, and no variant-valued
package or runtime witness is claimed. Matching, recursive variants, enum
syntax and the whole rope's first failures above remain open.

## Blockers by class

### Language expressiveness (Edict source)

The table below retains the upstream measurement at compiler `980c3ae3` and
Echo `9c32e0b5`. The named local candidate results above supersede only the
capabilities they actually measure; they do not change upstream support.

| Construct | Used by | Measured boundary |
| --- | --- | --- |
| Integer `+` on `U64` | both | Proved literal sum passes public build; unproved overflow refuses in type checking. General checked arithmetic remains [edict#263](https://github.com/flyingrobots/amblicit/issues/263). |
| Variant types and `match` | target 2 | Variant declaration parses, then refuses as `UnsupportedSourceShape`; `match` was not separately re-probed. [edict#261](https://github.com/flyingrobots/amblicit/issues/261) |
| Recursive types with a depth bound | target 2 | A recursive record refuses as `InvalidCoreTypeIntegrity` (`source type dependency cycle`). |
| Recursive functions with a termination measure | target 2 | Unbounded recursive helper refuses with `ReferenceCycle`; bounded measures remain [edict#262](https://github.com/flyingrobots/amblicit/issues/262). |
| Expression `if … else if …` | both | Previously confirmed; not separately re-probed. |
| Bytes slice and concatenation | both | The current flat-text public-build baseline passes. |
| Source-module import (`use module`) | both | Digest-authenticated module passes with the explicit source-module publication. |
| Bytes literals and escapes | both | `b"\\n\\r\\x00"` reaches the provider, which refuses the source helper; this is not a lexer refusal. |
| `Option` and its constructors | target 2 | `Option<U64>` helper result refuses in type checking; constructors were not separately re-probed. [edict#261](https://github.com/flyingrobots/amblicit/issues/261) |
| List literals | target 2 | Source compiles to Core; the checked provider refuses the helper. |
| `++` and `len(list)` | target 2 | `++` refuses in parsing; `len(list)` refuses with `TypeMismatch` because implemented `len` requires bounded bytes. |
| `enum` declarations | target 2 | `UnsupportedSourceShape` at resolve. [edict#261](https://github.com/flyingrobots/amblicit/issues/261) |
| Generic source helpers | both | `fn probe<T>` refuses in parsing at `<`. |
| `U8` | target 2 | `UnresolvedType`; the draft height and byte types need an explicit language decision. |
| Record spread `{ ...x, f: v }` | none | Removed from the drafts; not re-probed. |
| Function preconditions and flow-sensitive proofs | both | Function `where` refuses in parsing; branch-local proof inference was not separately re-probed. [edict#264](https://github.com/flyingrobots/amblicit/issues/264) |
| Typed failure in pure functions (`fails`, `expect`) | target 2 | `fails` refuses in parsing; `expect` was not separately re-probed. [edict#265](https://github.com/flyingrobots/amblicit/issues/265) |
| `U64` division and `min`/`max` | target 2 | Division refuses in type checking; `min` and `max` are unresolved helpers. [edict#263](https://github.com/flyingrobots/amblicit/issues/263) |
| `ContentAddressV1` inputs | both | Not re-probed; the identity-input contract remains [edict#260](https://github.com/flyingrobots/amblicit/issues/260). |

### Generic data-structure primitives

| Primitive | Used by | Current evidence |
| --- | --- | --- |
| Byte lookup (`at`) | both | Minimal source helper refuses with `UnresolvedFunction`; [edict#266](https://github.com/flyingrobots/amblicit/issues/266). |
| `count(bytes, byte)` | both | Bounded byte-count helper passes public build with the explicit publication. This supersedes the earlier blanket refusal claim. |
| `isUtf8(bytes)` | both | Bounded helper passes public build with the explicit publication. |
| `echo.attachmentDigest`, `echo.contentAddress` | both | Not re-probed; [edict#260](https://github.com/flyingrobots/amblicit/issues/260) owns the source inputs. |

None of these knows about text editing. They are byte and codec utilities.

### Runtime realization (Echo)

The [Authored Operation Effects design](https://github.com/flyingrobots/echo/blob/main/docs/architecture/authored-operation-effects.md)
owns the generic bridge. [echo#921](https://github.com/flyingrobots/echo/pull/921)
has merged; the earlier statement that its implementation was a draft is stale.
Native bridge work is not by itself a public compiler-to-graph witness for Jim.
This inventory measures pure public builds, not the effect, scheduler or recovery
paths below. Treat these as Jim's remaining proof obligations, not blanket claims
that every underlying primitive is absent from Echo.

| Need | Used by | Jim evidence still required |
| --- | --- | --- |
| Evaluated operation → proposed effects → atomic commit | both | Real compiler-produced operation admitted and committed through the generic bridge, with receipt, WAL and fresh-engine recovery. |
| `ensure` node: create, or require identical | both | Same-content and different-content controls through the authored operation. |
| Edge read by type, edge `ensure`, edge compare-and-retarget | both | Source/compiler/runtime agreement; typed reads are tracked by [echo#926](https://github.com/flyingrobots/echo/issues/926). |
| Atom compare-and-replace from evaluation | both | Actual authored result determines the replacement; caller-supplied output is not sufficient evidence. |
| Guided closure read with a pure selector | target 2 | Closure sufficiency, bounds and actual read evidence; [echo#926](https://github.com/flyingrobots/echo/issues/926). |
| Buffers reachable from the worldline root | both | Real root-to-buffer reachability witness; [echo#927](https://github.com/flyingrobots/echo/issues/927). |
| `for` with effects lowered to Target IR | target 2 | Actual authored loop lowering and bounded execution; [edict#267](https://github.com/flyingrobots/amblicit/issues/267). |

### Performance and resources

- Closure size: two boundary paths plus their inner spines, `O(h²)` nodes,
  with `h ≤ 1.44 log2(leaves)`. Bounded by `text.maxClosureNodes`.
- Patch size has three parts (DL-0159, Resource Envelope): the replacement tree,
  K leaves and K − 1 branches where K is `fromBytes`'s actual leaf count (8,194
  ASCII bytes give four leaves and three branches, not `ceil(8194 / 4096) = 3`
  leaves); boundary and join reconstruction, about `O(h)` path-copied branches
  and up to two split boundary leaves; and publication, one head with its `root`
  and `anchor` edges and one retargeted `canonicalHead` edge. Normalization can
  reduce emitted effects but not construction work. Echo caps one Action batch
  at 128 patch operations; a 1 MiB replacement (256 fresh
  leaves and 255 branches) is far outside it. The v1 operation supports an
  explicit envelope and refuses atomically outside it (DL-0159, Resource
  Envelope).
- The equal-length no-op check reads the replaced range, so its reads grow with
  the replacement; `text.maxReplacementBytes` bounds it.
- Echo's state root walks the reachable graph, the current representation, on
  every commit (DL-0159 risk).
- Echo charges a full copy for every local read; `Tree` values are large.

## Evidence plan

The 40-case oracle (6 committing, 34 obstructed) is a baseline generated from
the native planner. The rope is not complete until these also hold:

| Property | Evidence |
| --- | --- |
| Edit correctness | Generated edit sequences give the same logical text through target 1 and target 2, and through the native planner where its schema 1 cases apply. |
| Persistence | After N edits, each earlier state is reconstructable exactly to the extent its retention contract promises, and the test names that contract. No predecessor-head chain is kept. |
| Structural sharing | Nodes outside the boundary closure keep their ids across an edit. |
| Canonicalization | Logically equal facts encode to identical bytes; non-canonical encodings are refused. |
| Replay | The same admitted history reproduces identical roots and receipts on a fresh host. |
| Atomicity | A failure injected at any effect of a multi-node edit leaves no partial effect. |
| Conflict | A stale basis, or an `ensure` that meets different existing content, obstructs safely. |
| Unicode | UTF-8 boundaries, multi-byte scalars, combining marks, and surrogate-pair characters (four-byte UTF-8) at every split position. |
| Resource bounds | Exhausting steps, bytes, closure nodes, effects, or the Action-batch patch cap gives `ResourceLimitExceeded` with no commit. |
| Reopen and save | DL-0159's file-crossing gate. |
| Commutation | Two edits against one fixed basis: state exactly when their order can commute, and test that condition rather than assume it. |
| Closure sufficiency | Over generated trees and ranges, `replace` never fails with `ClosureTooSmall` (`ClosureInsufficient`) under the selector. |
| Identity | Source and bridge compute identical `ContentAddressV1` ids from published vectors, including empty and non-empty heads. |
| Normalization | Equal-content leaves yield one effect per id and both text positions survive. |

## Open design points in the drafts

- The closure selector's expansion rule (boundary paths, inner spines, and the
  no-op range) is argued, not proven. A `ClosureTooSmall` failure maps to
  `ClosureInsufficient`, a defect in the law, never `MalformedRope`; it should
  be impossible, and a property test must show it.
- Duplicate fresh leaves with equal content produce the same id twice. The
  source normalizes them (`rope.normalized`) before emitting the proposal;
  the bridge keeps rejecting duplicate targets.
- `Reference.edict`'s single text node is bounded at 1 MiB; target 1 says
  nothing about larger buffers.
