# ReplaceRange in Edict source: complete drafts

These files are the whole `ReplaceRange` program written the way it should
read, against the schema 2 representation in
[DL-0159](../../../docs/design/0159-edict-rope-representation.md). They are not
part of the application gate and they do not compile yet. Their job is to let
the program drive the language and runtime work instead of isolated probes.

| File | Target | Content |
| --- | --- | --- |
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

## Compiler result

Built against Edict main `e60411fc` with this application's lawpack closure:

| File | First refusal |
| --- | --- |
| `Text.edict` | parse: bytes literal `b"\n"` (bytes literals are not lexed; see below) |
| `Reference.edict` | parse: `use module` is not an import kind |
| `Rope.edict` | parse: `use module` is not an import kind |
| `ReplaceRange.edict` | parse: `use module` is not an import kind |

Edict main has since landed bytes literals and explicit escapes (`6e6a0fa`,
edict#249) and source-module compilation (edict#254), which clear all four
first refusals above. The next refusals have not been re-measured.

The parser stops at the first error, so the classification below is per
construct. **Confirmed** means a build against Edict main was run for that
construct. **Read** means it was established by reading compiler or runtime
source on main, not by running it.

## Blockers by class

### Language expressiveness (Edict source)

| Construct | Used by | Status on main |
| --- | --- | --- |
| Integer `+` on `U64` | both | refused, **confirmed** (`TypeMismatch`) |
| Variant types and `match` | target 2 | refused, **confirmed** (`only record type declarations`); [edict#261](https://github.com/flyingrobots/edict/issues/261) |
| Recursive types with a depth bound | target 2 | refused, **confirmed** (`UnresolvedType`) |
| Recursive functions with a termination measure | target 2 | refused, **confirmed** (`ReferenceCycle`); [edict#262](https://github.com/flyingrobots/edict/issues/262) |
| Expression `if … else if …` | both | accepted, **confirmed** |
| Bytes slice and concatenation | both | accepted, **confirmed** (leaf-slice, range-assembly probes) |
| Source-module import (`use module`) | both | landed after the measured run (edict#254); not re-measured |
| Bytes literals `b"…"` | both | landed after the measured run (`6e6a0fa`, edict#249); not re-measured |
| `\r` and explicit byte escapes | decoder only | landed after the measured run (`6e6a0fa`); not re-measured |
| `Option`, `some`/`none`/`isSome`/`unwrap` | target 2 | refused, read; [edict#261](https://github.com/flyingrobots/edict/issues/261) |
| `List` construction, `++`, `len(list)` | target 2 | refused, read |
| `enum` declarations | target 2 | refused, read |
| Record spread `{ ...x, f: v }` | both | refused, read |
| Function preconditions and flow-sensitive proofs for `-` and `slice` | both | refused inside functions, read |
| Typed failure in pure functions (`fails`, `expect`) | target 2 | not in the spec; proposed |
| `U64` division, `min`/`max`, checked `+` | target 2 | refused, read; [edict#263](https://github.com/flyingrobots/edict/issues/263) |
| `ContentAddressV1` inputs (type id, attachment digest, ordered edges) | both | absent; [edict#260](https://github.com/flyingrobots/edict/issues/260) |

### Generic data-structure primitives

| Primitive | Used by | Why |
| --- | --- | --- |
| `core.bytes.at(bytes, i) -> U8` | both | UTF-8 boundary check |
| `core.bytes.count(bytes, byte) -> U64` | both | line-break metric |
| `core.bytes.isUtf8(bytes) -> Bool` | both | replacement validity |
| `echo.attachmentDigest(value)`, `echo.contentAddress(type, digest, edges)` | both | `ContentAddressV1` inputs, Echo's exact codec profile (edict#260) |

None of these knows about text editing. They are byte and codec utilities.

### Runtime realization (Echo)

All are covered by the Echo design
[Authored Operation Effects](https://github.com/flyingrobots/echo/blob/main/docs/architecture/authored-operation-effects.md),
whose implementation is [echo#921](https://github.com/flyingrobots/echo/pull/921) (draft):

| Need | Used by | Status on main |
| --- | --- | --- |
| Evaluated operation → proposed effects → atomic commit | both | absent (read) |
| `ensure` node: create, or require identical | both | absent; create obstructs on existing (read) |
| Edge read by type, edge `ensure`, edge compare-and-retarget | both | absent (read); edge reads [echo#926](https://github.com/flyingrobots/echo/issues/926) |
| Atom compare-and-replace from evaluation | both | only with caller-supplied bytes (read) |
| Guided closure read with a pure Edict selector | target 2 | absent (read); [echo#926](https://github.com/flyingrobots/echo/issues/926) |
| Buffers reachable from the worldline root | both | absent (read); [echo#927](https://github.com/flyingrobots/echo/issues/927) |
| `for` with effects lowered to Target IR | target 2 | Target refuses `For` (read) |

### Performance and resources

- Closure size: two boundary paths plus their inner spines, `O(h²)` nodes,
  with `h ≤ 1.44 log2(leaves)`. Bounded by `text.maxClosureNodes`.
- Patch size: about `(h + 1)` new branches, up to 2 new leaves plus
  `ceil(replacement / 4096)` fresh leaves, two edges per branch, one head with
  its `root` and `anchor` edges, and one retargeted `canonicalHead` edge. Echo
  caps one Action batch at 128 patch operations; a 1 MiB replacement (256 fresh
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
