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

With the merged Edict #201, the public application build lowers those Core `let`
nodes into generic, source-ordered Target IR and independently verifies the compiler-owned
result projection. The pinned Echo #724 candidate emits a distinct
`compiler-produced-bounded-pure/v1` executable package containing the exact
Core, lawpack exports, Target IR, and result projection. Echo's structurally
separate verifier independently reconstructs that package relation and emits an
accepted report bound to retained canonical `echo.executable-subject/v1` bytes.

The compiler pin is Edict main `3f81f759e921a69b04fe8cf8e62e62f8f3dc7b7e`.
Core retains the imported nominal definitions and their shared exact-length
`NodeId` representation; record fields refer to those named definitions.
The nominal identity test follows that reference chain, and repeated public
builds must reproduce identical Core, Target, package, and verifier-report bytes.
The Echo provider remains pinned to the open #724 candidate
`49e9efb68001dfd78563d18bac9359a87671e431`; this evidence does not claim that
provider or this Jedit application has landed on its repository's main branch.

The application gate passes that accepted package unchanged to Echo's generic
pure evaluator at `8c725d699241a7e3adee482029031ff6bade25fa`, the open #726
candidate. A separate test-only Rust host consumes the fresh public-build
output, not the fixture retained in Echo. It checks both conditional branches,
the imported helper result, exact projected bytes, deterministic repetition,
the reversed-range constraint, malformed identity bytes, and package-pin
substitution. Its dependencies and their full resolution are pinned in
`tests/runtime/Cargo.toml` and `Cargo.lock` and bound into the build closure.

This is pure computation only. No graph or rope is mutated, no Tick is settled,
and no WAL or recovery evidence is produced. The test host enables Echo's
trusted-host API only in this standalone unpublished test crate. It is not a
production dependency or an alternate editor route. The authored rope algorithm
and generic stateful execution remain unfinished under #296.

## Reproduce

Run the build script inside Docker with copies of the exact Edict and Echo
checkouts. Do not mount host repositories or Git directories into the container:

```bash
EDICT_REPO=/path/to/edict \
ECHO_REPO=/path/to/echo \
CARGO_TARGET_DIR=/path/to/disposable-runtime-build-cache \
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

The harness takes the compiler executable path from Cargo's successful
`compiler-artifact` output. `CARGO_TARGET_DIR` may therefore point outside the
Edict checkout, as it does in CI; no pre-existing `target/debug/edict` is needed.
The runtime witness uses the same configured build cache. A regression runs the
full package chain against an isolated Edict checkout whose default binary path
is absent before and after execution.

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
`.build/` is disposable output. `CARGO_TARGET_DIR` optionally selects a shared
disposable Cargo cache; otherwise runtime build output stays under `.build/`.
The runtime witness runs with `--locked` and must emit its completion marker
after all assertions pass, so a zero-test Cargo invocation cannot satisfy the
gate. The provider stays pinned to #724; the runtime is independently pinned
to #726. Neither is described as a released or installed product dependency.
Distinct nominal `BufferId` and `HeadId`
contracts retain the same exact 32-byte representation, while a negative
compiler witness proves that neither can cross the imported lawpack boundary as
the other.

The next gate must exercise an authored rope consequence under generic Echo
stateful execution and compare it with the independent oracle. This pure
boundary witness is not a substitute for that evidence.
