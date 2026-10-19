# Basis identity comparison witness

These Jim-owned sources isolate byte equality required by ReplaceRange's
basis validation and content comparisons. They are conformance inputs for
[Echo #738](https://github.com/flyingrobots/echo/issues/738), not the completed
operation from [Jim #296](https://github.com/flyingrobots/jedit/issues/296).

`ReplaceRange.edict` compares two `text.HeadId` values through their declared
32-byte representation. `PayloadEquality.edict` compares bounded variable
byte payloads, including empty values and unequal lengths, to exercise work
accounting. Both return an authored numeric branch result. An observed ID
supplied as input is **not** evidence of the graph's current head. Neither
source reads state, decodes a fact, grants authority, or admits an edit.

## Build the exact packages

From the repository root:

```sh
docker build -f edict/replace-range-probes/basis-identity/Dockerfile \
  -t jim-byte-comparison .
docker run --name jim-byte-comparison-proof jim-byte-comparison
docker cp jim-byte-comparison-proof:/comparison-output <destination>
```

The COPY-based image builds the existing pinned compiler
`3f81f759e921a69b04fe8cf8e62e62f8f3dc7b7e` using Rust 1.94.0, fetches the
existing pinned provider `49e9efb68001dfd78563d18bac9359a87671e431`, and invokes
Edict's public JSONL application-build boundary. Each disposable application
copy retains the frozen application manifest and complete published lawpack;
only its source file changes. No host repository or Git directory is mounted.

The success marker is `JIM_BYTE_COMPARISON_PACKAGES_BUILT`. Output contains
`head/` and `payload/`, each with the emitted executable package and its separate
accepted verification report. Echo's runtime tests must consume these exact
bytes, never construct a program from the schema or oracle. The frozen
`edict/replace-range/` application, runtime host, and producer locks are unchanged.

The original evaluator at `8c725d699241a7e3adee482029031ff6bade25fa` refuses
byte equality as `UnsupportedProgram`. The Echo prerequisite adds bounded,
metered byte equality; it does not provide snapshot reads or make the full
ReplaceRange acceptance criteria complete. Generic fact reads, application-owned
codecs and rope semantics, admitted execution, independent oracle agreement,
Tick, receipts, WAL, and recovery remain required by #296.
