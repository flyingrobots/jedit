# ReplaceRange Edict application

This directory is the Jedit-owned application root for issue #296. It keeps
the authored, built, and evidentiary artifact classes separate:

- `edict.lawpack.json` is the reviewable `jedit.text@1` authoring input;
- `vendor/jedit-text/` is Edict's canonical published lawpack closure;
- `src/ReplaceRange.edict` is the application-owned source;
- `edict.toolchain-lock.json` pins the exact build implementations and
  provider;
- `edict.build-lock.json` pins the exact source closure and emitted artifact
  chain;
- `edict.executable-subject-lock.json` pins the verified executable meaning;
- `.build/` contains disposable provider and compiler outputs;
- `contracts/jedit/lawpacks/replace-range-v1/` remains the independent schema
  and oracle corpus and is not executable input.

## Current executable boundary

The checked-in source is the first compiler-pressure slice, not a completed
text mutation. It binds exact-length nominal identities, the selected basis,
range, replacement bytes, operation profile, budget, imported helper
implementation, and a pure conditional into Edict Core. It intentionally does
not claim to traverse or rewrite a rope yet.

With Edict #201, the public application build lowers those Core `let` nodes into
generic, source-ordered Target IR and independently verifies the compiler-owned
result projection. Echo #724 now emits a distinct
`compiler-produced-bounded-pure/v1` executable package containing the exact
Core, lawpack exports, Target IR, and result projection. Echo's structurally
separate verifier independently reconstructs that package relation and emits an
accepted report bound to retained canonical `echo.executable-subject/v1` bytes.

That accepted package is the current routing evidence required by #296: Edict
preserves the bounded pure program without learning Jedit vocabulary, and Echo
packages it without learning `ReplaceRange`. No Echo evaluator runs, no graph
or rope is mutated, and no Tick is settled. This is not evidence that
`ReplaceRange` mutates a rope or that Jim runs end to end.

## Reproduce

The build script requires exact local Edict and Echo checkouts:

```bash
EDICT_REPO=/path/to/edict \
ECHO_REPO=/path/to/echo \
  ./edict/replace-range/tests/build.sh
```

`edict.toolchain-lock.json` pins the exact Edict commit and CLI release, Rust
toolchain, Echo commit, provider identity, provider manifest bytes, and lowerer
and verifier components. It also pins the Node and npm releases, the resolved
`cbor-x` package and integrity, and the package, lockfile, and CI invocation
bytes that perform validation. The script refuses non-Git roots, wrong commits,
dirty checkouts, or validation-environment drift before invoking either
toolchain. GitHub's package-chain job checks out and verifies the literal pull
request head; ordinary matrix jobs may separately exercise the synthetic merge.

`edict.build-lock.json` binds the exact source and validation closure to the
Core, Target IR, result projection, executable package, verification report,
and executable-subject identities. The raw Echo report remains a separately
identified artifact. A canonical-JSON Jedit evidence envelope binds that artifact
and subject to the exact provider release, verifier component, diagnostic ABI,
report ABI, and outcome; that verifier-specific envelope is the transitional
`VerificationReportId`. `edict.executable-subject-lock.json` separately records
the subject identity and the exact package, Target IR, and result-projection
references it contains. The harness recomputes every digest from emitted bytes
and refuses a valid report paired with a substituted package or verifier. The
locks contain no self-referential Jedit commit; an exact PR head remains an
external review coordinate.

The script verifies the committed `jedit.text@1` closure through Edict's public
lawpack `checkOnly` boundary. It never republishes or repairs that authoritative
tree. It then copies Echo's checked provider package into `.build/`, invokes
Edict's public application build, and requires the generic pure package and an
accepted independent-verifier report. Snapshots cover the application inputs
outside `.build/`, the pinned project validation files, and every tracked Edict
and Echo file; any content, identity, or timestamp mutation fails the run. Only
`.build/` is disposable output. Distinct nominal `BufferId` and `HeadId`
contracts retain the same exact 32-byte representation, while a negative
compiler witness proves that neither can cross the imported lawpack boundary as
the other.

The gate must advance again when Echo implements generic pure evaluation;
package acceptance is not a permanent substitute for runtime evidence.
