# Reproduce the arithmetic and byte inventory

The `primitives` group measures subtraction, slicing, byte metrics, function
preconditions, typed failures, and `min`/`max` through the public application
builder. [The inventory entrance](README.md) owns guarded-worker setup and
replay commands. Add `--group primitives`, then run the consumer and
`iterative-primitives.test.mts` with that report's exact hash.

## Selected artifacts

The 2026-11-09 run uses Amblicit
`66bf6bac369f67e32ddaee099c3198bd30f885a1` and Echo
`089c849f766d5331835e7d10148a378cdb1237d5`. Both still matched their remote
main branches when checked during this measurement. The compiler SHA-256 is
`12d169ac6d4acccd7dcd614bb9cc11939982c5aa48531a98dc2875936849f872`;
the provider-manifest SHA-256 is
`492b2ac958c49f113500c5b29c12cc41e1b85f4071ef0c9f6424e5aeba3cbe98`.
The fifteen-case public report is
`71ae487876901523e7538ad32ebb191ba033622ec75f0b9ab2b97200ced808ee`.

| Shape | First observed result | Existing requirement owner |
| --- | --- | --- |
| Subtraction under an intent input constraint | Public build and generic runtime accept | Amblicit #263/#264 |
| Byte slice under intent range constraints | Public build and generic runtime accept | Amblicit #264 |
| Invoked helpers for guarded byte access, count and UTF-8 validity | Public build and generic runtime accept | Amblicit #266 |
| Subtraction in a guarded helper | Provider lowerer refuses | Amblicit #264; generic provider work in Echo #684 |
| Slice in a guarded helper | Provider lowerer refuses | Amblicit #264; generic provider work in Echo #684 |
| Subtraction without a range proof | Source `UnsupportedSourceShape` | Expected refusal control |
| Function `where` declaration | Source parser `ExpectedToken` | Amblicit #264 |
| Function `fails` declaration | Source parser `ExpectedToken` | Amblicit #265 |
| `min` and `max` calls, measured separately | Source `UnresolvedFunction` | Amblicit #263 |

Together with the existing controls, seven builds accept, six refuse in source,
and two refuse in the provider lowerer. The latter passed earlier stages by the
inspected compiler's command order; verifier and runtime remain unreached.
See [upstream reconciliation](upstream-status.md) for linked owners and limits.

## Runtime evidence

The independent verifier's accepted package binding is checked before generic
evaluation. Twenty-four new inputs plus four prior controls use literal expected
results: five differences, seven byte slices, and twelve byte-metric records.
They cover empty/full ranges, U64::MAX, arbitrary binary bytes, slices through
UTF-8 code points, empty/max-length byte strings, end/max indices, valid UTF-8,
overlong sequences, surrogates, out-of-range code points and truncation.

All positive inputs check exact-budget replay, three one-unit-short refusals,
and a wrong package identity. Seven invalid ranges fail input constraints;
six additional malformed inputs fail type/bound validation. The three prior
malformed-input controls remain. No expected byte result is calculated by a
native slicing or rope implementation.

The preceding consumer first failed all nine new stage assertions because it
did not admit this group. The first implemented run also caught an invalid
witness input: U64::MAX + 1 cannot be encoded by the canonical CBOR profile, so
it did not reach runtime admission. Its source and failure are retained. The
runtime type-refusal control now uses a representable Bool in a U64 field.

The final debug and optimized runs both pass all twenty-eight runtime inputs,
nine primitive stage assertions, and sixteen applicable admission assertions.
Four module-only admission assertions are skipped for this group. The two
runtime transcripts match byte for byte. Strict TypeScript, explicit syntax
limits for all six inventory MTS files, repository quality, Rust formatting
and Clippy also pass. These focused checks do not replace the full application
gate or independent review.

The complete public snapshot is retained as
`jedit-388-primitives-bound-matrix.tar.gz`, SHA-256
`0dbacc544c777de2b8bab8a42e5cf8e7226b5a0df280c4682cefa88e5623e6de`.
Debug evidence is `jedit-388-primitives-final-debug.tar.gz`, SHA-256
`3978f2f6598e4a39f1ae0aa22e0120928fa681c46f2f2d713046e21ac7838ba1`;
optimized evidence is `jedit-388-primitives-final-release.tar.gz`, SHA-256
`2921760f715f22aa02f660c1fc49c616bda01bde4fb6ee71d5d36da8d6d2e1a4`.
Archive membership and bytes were compared with the original trees, and the
exported archives were hash-checked before reclaiming duplicate expansions.

## Earlier wrapper measurement

The retained direct-return report is
`3b58a4ec6961feba006f8d34a1a34d57298510ef87186ad3af8944ce66374475`.
Five otherwise source-admitted probes first stopped at Target `NoTargetSteps`.
Binding their expressions with ordinary `let` statements before returning
reaches the primitive/provider boundaries reported above. The wrapper result
does not establish that those primitives are unsupported. Both complete source
snapshots and original diagnostics remain outside Git.

## Branch-fact boundary

The selected lowerer adds branch predicates to
[`self.path`#596:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/crates/echo-edict-provider-lowerer/src/executable_operation/source_functions.rs#L596).
Its subtraction and slice checks call
[`order::proven`#742:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/crates/echo-edict-provider-lowerer/src/executable_operation/source_functions.rs#L742)
with `self.proven`, without that path. This is another measured branch-context
gap alongside the addition probes. A narrow Echo issue is still proposed,
pending publication authorization; broad existing owners remain open.

These results do not establish function contracts, typed pure failures, graph
effects, component regeneration, or any of the forty rope acceptance cases.
