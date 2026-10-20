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

The authored source computes flat-text replacement as prefix + replacement +
suffix. Its ordered guard checks the range before slicing, validates the full
original text and replacement as UTF-8, validates both offset prefixes as
UTF-8, and rejects byte-identical replacements. The guard reports a generic
input-constraint refusal; it does not yet produce the domain's typed outcomes.

The imported constant helper has its own small cost declaration. The operation
budget separately includes bounded UTF-8 scan work. Reusing the operation's
entire budget as the constant helper's cost would consume that budget before
accounting for the scans.

The standalone test host supplies bytes to the freshly compiled package. It
checks nine literal replacements, thirteen range, UTF-8 and no-op refusals,
and five host-resource refusals. It performs no native replacement and links
no native rope planner. The package-chain harness runs both the boundary and
flat-text targets, and the build closure includes both test sources.

The toolchain pins Edict main `2ddc0692ae894c786e8f37b497719191ad7d4d69`
and Echo main `0faaf58a15a4b03036cf36b465d79af76c952193`. The generated
build and executable-subject locks bind the changed source, vendor publication,
provider and test closure. Public macOS and Linux builds emit identical package
and verifier-report bytes. The package identity is
`sha256:37b51045160d164b520b3c36af7521659fd199f08e09314bd52c312dd825c47d`.
The Docker package-chain gate checks the exact clean Git toolchains, rebuilds
through the public CLI, verifies the locks, runs both runtime targets and
refuses mutation of authoritative inputs.

This is pure computation. No graph or rope is mutated, no Tick is settled,
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
gate. The provider and the runtime are both pinned to the same Echo main
commit. Neither is described as a released or installed product dependency.
Distinct nominal `BufferId` and `HeadId`
contracts retain the same exact 32-byte representation, while a negative
compiler witness proves that neither can cross the imported lawpack boundary as
the other.

The next gate must exercise an authored rope consequence under generic Echo
stateful execution and compare it with the independent oracle. This pure
boundary witness is not a substitute for that evidence.

## Moving to new Echo and Edict commits

`scripts/deps/echo-edict-relock.mjs` moves Jedit to the Echo and Edict commits checked out in two clean checkouts and regenerates everything derived from them: the host's and conformance runtime's Echo pins, the host's Wesley contract bindings, the ReplaceRange oracle, this lawpack's oracle digests and target-adapter profile and IR references, the vendored `jedit-text` publication and the source's import digest, the toolchain lock, and the build and executable-subject locks. It then runs `tests/build.sh`. Run it with the Node, npm, and Rust releases this toolchain lock pins:

```bash
node scripts/deps/echo-edict-relock.mjs --echo-repo /path/to/echo --edict-repo /path/to/edict
```

It refuses to start unless the files it manages are clean, and any failure (a host that no longer compiles against the new Echo, a refused build, a broken package chain) restores them and removes anything the run created, so a failed relock leaves the tree as it found it. A host that stops compiling is source work, not relocking.
