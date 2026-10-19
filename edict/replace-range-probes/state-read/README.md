# State-read ordering probe

This is development evidence for [#296](https://github.com/flyingrobots/jedit/issues/296)
and [PR #302](https://github.com/flyingrobots/jedit/pull/302). It is not the
ReplaceRange implementation, an admitted operation, or a runtime capability.
The frozen application and producer pins under `edict/replace-range/` are
unchanged.

ReplaceRange must read a buffer's canonical head and compare it with the
requested basis before accepting an edit. A caller-provided head is not proof
of current state. This deliberately small authored source asks for that
read-then-check sequence through a Jim-owned semantic effect.

The lawpack proposes `readCanonicalHead(BufferId) -> HeadId`, with a typed
missing-fact obstruction. Its `snapshot-read-probe` target intrinsic is an
explicit placeholder: **Echo does not implement it**. The retained pure-provider
configuration is intentionally incompatible with stateful execution. This
fixture establishes a compiler boundary, not an agreed future read ABI,
footprint model, canonical fact decoder, or provider implementation.

## Reproduce

From the repository root, build and run without mounting a host repository:

```sh
docker build -f edict/replace-range-probes/state-read/Dockerfile \
  -t jedit-state-read-boundary .
docker run --rm jedit-state-read-boundary
```

The image pins Edict to `77f4a91080a6c2c875fe349da6fc6a64525947a2`
and the existing Echo provider to
`49e9efb68001dfd78563d18bac9359a87671e431`. Both revisions are fetched inside
Docker. The harness copies inputs to disposable container storage and uses the
public lawpack/application JSONL build API; it constructs no Core, Target IR,
executable package, or native edit plan.

Expected evidence:

1. The complete lawpack builds, and its generated digest matches the authored
   import.
2. The source with the basis guard rejects at `TargetLoweringFailed`, with
   `obstruction_requirement_step_output_dependency`.
3. A control removes only that guard. It reaches the provider and rejects at
   `ProviderLowererRefused`, with `UnsupportedSemantics`.
4. Neither refusal publishes application output artifacts.

The harness prints `JEDIT_STATE_READ_BOUNDARY_CONFIRMED` when both boundaries
are observed. A passing harness therefore means the limitation is reproduced;
it does **not** mean state reads or ReplaceRange work.

## Required follow-through

[Edict #218](https://github.com/flyingrobots/edict/issues/218) owns the ordered
Target IR prerequisite exposed here.

Edict currently separates pure bindings, requirements, and target steps.
Requirements are pre-step guards. Supporting this operation requires an
explicit ordering contract; deleting the rejection alone would lose the
read-before-check meaning. The compiler must preserve dependencies and reject
forward or fabricated references. Existing artifact identities and consumers
need a deliberate compatibility path.

After that compiler contract exists, Echo still needs an independently verified,
generic snapshot-read and private staged-write execution path. Reads must share
the admitted application snapshot; an obstruction must not publish partial
edits. Jim owns canonical fact decoding, rope algorithms, identities, and typed
obstructions. Complete rope transformation, oracle agreement, footprints,
budgets, Tick/WAL/receipt, and recovery remain the acceptance criteria of #296.
