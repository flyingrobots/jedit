# Node atom read and guard probe

This is authored consumer evidence for
[Echo #740](https://github.com/flyingrobots/echo/issues/740),
[Jedit #296](https://github.com/flyingrobots/jedit/issues/296), and
[PR #302](https://github.com/flyingrobots/jedit/pull/302). It reproduces an
unsupported provider boundary. **It does not implement reads or ReplaceRange.**
The frozen application and producer pins under `edict/replace-range/` remain
unchanged.

The source requests the opaque atom bytes at an explicit address, compares
them with expected bytes, then returns them. The proposed address contains
32-byte WARP, node, and expected atom-type IDs. Four named failure arms cover
missing data, wrong atom type, non-atom attachments, and the byte bound. The
exported type uses Edict's canonical `Record<...>` syntax with sorted fields.
The output is bounded to 1 MiB.

`echo.dpo@1.node-atom-read` and its failure coordinates are **proposed** target
contracts. Echo does not implement them. The pure provider configuration is
retained deliberately to identify its refusal boundary; it must not be treated
as permission for stateful execution. The experimental `echo.span-ir/v2`
selection binds the pinned Edict CDDL bytes, not a released semantic profile.

## Reproduce

From the repository root, with no host repository mounted into Docker:

```sh
docker build -f edict/replace-range-probes/node-atom-read/Dockerfile \
  -t jedit-node-atom-read-boundary .
docker run --rm jedit-node-atom-read-boundary
```

The Dockerfile fetches exact revisions:

- Edict `2405a550e93e1e97fff640caa44bbd0f65ffff3c` supplies ordered Target IR.
- Echo `49e9efb68001dfd78563d18bac9359a87671e431` supplies the old provider control.
- Echo `84ccbcec0640f2c7d0565464fd55655007689b42` supplies the public generator
  example that assembles and digest-admits an ordered-schema provider candidate.

The witness uses the public lawpack/application JSONL build API. It checks:

1. The lawpack builds and its generated digest equals the authored import.
2. The old provider refuses ordered IR at `InvalidProviderInvocation`, naming
   `ArtifactSchemaMismatch` and `06-target-ir`.
3. Changing only the provider to the ordered-schema candidate reaches
   `ProviderLowererRefused`, naming `UnsupportedSemantics` and
   `core.echo-pure-operation`.
4. Neither refusal publishes application outputs; the authored body is unchanged.

Success prints `JEDIT_NODE_ATOM_READ_PROVIDER_BOUNDARY_CONFIRMED`. That means
the limitation was reproduced, not that an executable read package was emitted.
The harness neither fabricates intermediate artifacts nor substitutes a native
read implementation.

## What remains

Echo #740 owns explicit read-capable provider configuration, independent
verification, real bounded evaluation over graph storage, basis/aperture
enforcement, ordered guards, typed failures, and deterministic accounting.
No ordinary caller-provided bytes may stand in for an authorized read view.

Jim owns fact decoding. Its canonical Buffer head is a field inside an encoded
fact, not the entire atom payload. Returning raw bytes does not supply that head
without the application-owned decoding step. Rope operations, staged writes,
admission, oracle agreement, Tick/WAL/receipts, and recovery remain the parent
issues' requirements.
