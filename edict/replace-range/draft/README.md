# ReplaceRange in Edict source: complete drafts

These files are the whole `ReplaceRange` program written the way it should
read, against the schema 2 representation in
[DL-0159](../../../docs/design/0159-edict-rope-representation.md). They are not
part of the application gate and they do not compile yet. Their job is to let
the program drive the language and runtime work instead of isolated probes.

| File | Target | Content |
| --- | --- | --- |
| `Text.edict` | shared | schema 2 facts, edge types, identity law, text metrics |
| `Reference.edict` | 1: semantic correctness | flat-text `ReplaceRange`; deliberately inefficient |
| `Rope.edict` | 2: persistent rope | pure AVL split, join, balance, build, collect |
| `ReplaceRange.edict` | 2: persistent rope | closure read, pure replace, `ensure` effects, head retarget |

The two targets are separate on purpose. Target 1 needs almost no new language
and isolates the Echo effect bridge. Target 2 adds the language features a
persistent structure needs. Target 1 then serves as a differential oracle for
target 2: they must agree on logical text and outcomes, not physical roots.
Target 1 does not complete the rope.

## Compiler result

Built against Edict main `e60411fc` with this application's lawpack closure:

| File | First refusal |
| --- | --- |
| `Text.edict` | parse: bytes literal `b"\n"` (bytes literals are not lexed; see below) |
| `Reference.edict` | parse: `use module` is not an import kind |
| `Rope.edict` | parse: `use module` is not an import kind |
| `ReplaceRange.edict` | parse: `use module` is not an import kind |

The parser stops at the first error, so the classification below is per
construct. **Confirmed** means a build against Edict main was run for that
construct. **Read** means it was established by reading compiler or runtime
source on main, not by running it.

## Blockers by class

### Language expressiveness (Edict source)

| Construct | Used by | Status on main |
| --- | --- | --- |
| Integer `+` on `U64` | both | refused, **confirmed** (`TypeMismatch`) |
| Variant types and `match` | target 2 | refused, **confirmed** (`only record type declarations`) |
| Recursive types with a depth bound | target 2 | refused, **confirmed** (`UnresolvedType`) |
| Recursive functions with a termination measure | target 2 | refused, **confirmed** (`ReferenceCycle`) |
| Expression `if … else if …` | both | accepted, **confirmed** |
| Bytes slice and concatenation | both | accepted, **confirmed** (leaf-slice, range-assembly probes) |
| Source-module import (`use module`) | both | refused, **confirmed** |
| Bytes literals `b"…"` | both | refused anywhere, **confirmed**: lexed as identifier `b` then a string; [edict#249](https://github.com/flyingrobots/edict/issues/249) |
| `\r` and explicit byte escapes | decoder only | refused, **confirmed**; [edict#249](https://github.com/flyingrobots/edict/issues/249) |
| `Option`, `some`/`none`/`isSome`/`unwrap` | target 2 | refused, read |
| `List` construction, `++`, `len(list)` | target 2 | refused, read |
| `enum` declarations | target 2 | refused, read |
| Record spread `{ ...x, f: v }` | both | refused, read |
| Function preconditions and flow-sensitive proofs for `-` and `slice` | both | refused inside functions, read |
| Typed failure in pure functions (`fails`, `expect`) | target 2 | not in the spec; proposed |
| `U64` division, `min`/`max` | target 2 | refused, read |
| Source `hash` with a domain label | both | in the spec; not implemented, read |

### Generic data-structure primitives

| Primitive | Used by | Why |
| --- | --- | --- |
| `core.bytes.at(bytes, i) -> U8` | both | UTF-8 boundary check |
| `core.bytes.count(bytes, byte) -> U64` | both | line-break metric |
| `core.bytes.isUtf8(bytes) -> Bool` | both | replacement validity |
| `core.cbor.encode(value)` | both | identity input in the canonical codec |

None of these knows about text editing. They are byte and codec utilities.

### Runtime realization (Echo)

All are covered by the proposed Echo design
[Authored Operation Effects](https://github.com/flyingrobots/echo/blob/docs/edict-authored-operation-effects/docs/architecture/authored-operation-effects.md):

| Need | Used by | Status on main |
| --- | --- | --- |
| Evaluated operation → proposed effects → atomic commit | both | absent (read) |
| `ensure` node: create, or require identical | both | absent; create obstructs on existing (read) |
| Edge read by type, edge `ensure`, edge compare-and-retarget | both | absent (read) |
| Atom compare-and-replace from evaluation | both | only with caller-supplied bytes (read) |
| Guided closure read with a pure Edict selector | target 2 | absent (read) |
| `for` with effects lowered to Target IR | target 2 | Target refuses `For` (read) |

### Performance and resources

- Closure size: two boundary paths plus their inner spines, `O(h²)` nodes,
  with `h ≤ 1.44 log2(leaves)`. Bounded by `text.maxClosureNodes`.
- Patch size: about `(h + 1)` new branches, up to 2 new leaves plus
  `replacement / 4096` leaves, two edges per branch, one head, three head
  edges. Echo caps a Tick at 128 operations, which a 1 MiB replacement exceeds;
  the cap or the replacement bound must move, and that is a measured decision.
- Echo's state root walks all reachable history on every commit (DL-0159 risk).
- Echo charges a full copy for every local read; `Tree` values are large.

### Ordinary defects

- [jedit#350](https://github.com/flyingrobots/jedit/issues/350): reopen reuses
  a stale rope. Prerequisite for durable file integration.
- [edict#249](https://github.com/flyingrobots/edict/issues/249): lexer escapes.

## Evidence plan

The 40-case oracle (6 committing, 34 obstructed) is a baseline generated from
the native planner. The rope is not complete until these also hold:

| Property | Evidence |
| --- | --- |
| Edit correctness | Generated edit sequences give the same logical text through target 1 and target 2, and through the native planner where its schema 1 cases apply. |
| Persistence | After N edits, every earlier head is still readable and unchanged. |
| Structural sharing | Nodes outside the boundary closure keep their ids across an edit. |
| Canonicalization | Logically equal facts encode to identical bytes; non-canonical encodings are refused. |
| Replay | The same admitted history reproduces identical roots and receipts on a fresh host. |
| Atomicity | A failure injected at any effect of a multi-node edit leaves no partial effect. |
| Conflict | A stale basis, or an `ensure` that meets different existing content, obstructs safely. |
| Unicode | UTF-8 boundaries, multi-byte scalars, combining marks, and surrogate-pair characters (four-byte UTF-8) at every split position. |
| Resource bounds | Exhausting steps, bytes, closure nodes, or the Tick operation cap gives a typed result with no commit. |
| Reopen and save | An external file change can never silently reuse stale rope state (#350). |
| Commutation | Two edits against one fixed basis: state exactly when their order can commute, and test that condition rather than assume it. |
| Closure sufficiency | Over generated trees and ranges, `replace` never fails with `ClosureTooSmall` under the selector. |

## Open design points in the drafts

- The closure selector's expansion rule (boundary paths, inner spines, and the
  no-op range) is argued, not proven. A `ClosureTooSmall` failure maps to
  `MalformedRope`; it should instead be impossible, and a property test must
  show it.
- Duplicate fresh leaves with equal content produce the same id twice; the
  effect bridge must make a repeated `ensure` in one proposal canonical.
- `Reference.edict`'s single text node is bounded at 1 MiB; target 1 says
  nothing about larger buffers.
