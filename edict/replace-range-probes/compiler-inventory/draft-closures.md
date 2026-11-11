# Measure the complete supplied draft sources

The `drafts` inventory group supplies the unchanged Text, Reference, Rope and
ReplaceRange roots with their full source-module closures, including Boundary.
It preserves their `jedit.text@2` imports. The selected application only provides
the published version-1 lawpack, so this is not a complete version-2 application
dependency closure. [The inventory entrance](README.md) owns guarded setup and
replay commands; add `--group drafts` and use `iterative-drafts.test.mts`.

## Selected artifacts

The 2026-11-09 public run selects Amblicit
`66bf6bac369f67e32ddaee099c3198bd30f885a1`, Echo
`089c849f766d5331835e7d10148a378cdb1237d5`, compiler SHA-256
`12d169ac6d4acccd7dcd614bb9cc11939982c5aa48531a98dc2875936849f872`,
and provider-manifest SHA-256
`492b2ac958c49f113500c5b29c12cc41e1b85f4071ef0c9f6424e5aeba3cbe98`.
The ten-case public report is
`40d6808fff828559f5100bbde8d76cd9f64ee007ca1b535117e71da6e826a76a`.

| Draft root | Supplied source modules, root first | First observed refusal |
| --- | --- | --- |
| Text | Text, Boundary | Parse `ExpectedToken`: `contentId<T>`, line 90 |
| Reference | Reference, Text, Boundary | Parse `ExpectedToken`: nested read-expression `else`, line 55 |
| Rope | Rope, Text, Boundary | Parse `ExpectedToken`: recursive variant `depth`, line 24 |
| ReplaceRange | ReplaceRange, Text, Boundary, Rope | Parse `ExpectedToken`: enum declaration, line 49 |

The root is copied to `src/Probe.edict`; imported files live under `src/drafts/`.
Their source bytes and digest-bound import declarations remain unchanged. The
runner verifies existing pins before compiling and retains the original five
files, selected per-case source lists, and source-pin driver. Its v3 report adds
`draftDriverSha256` for this group, which the consumer requires and checks.

The flat-text baseline and three fold controls build successfully. The dynamic
fold still refuses in source checking. Together with the four draft parse
refusals and the dependency probe below, this gives four accepted builds, five
source refusals and one Target refusal. Four generic pure runtime inputs belong
to the existing controls; none executes a whole draft.

## Validation and retained evidence

The preceding consumer fails all six new draft assertions and the source-pin
driver admission assertion. The completed consumer passes six draft assertions
and eighteen applicable admission assertions in both debug and optimized
builds; four module-only assertions are skipped. Both builds execute the four
control inputs with exact/insufficient budgets and identity/type refusals, and
their runtime transcripts match byte for byte. A substituted Boundary leaf
with self-consistent case metadata refuses before execution. Strict TypeScript,
syntax limits for all seven inventory MTS files, repository quality, Rust
formatting and Clippy pass. Full application gates and review remain separate.

The complete public snapshot is `jedit-388-drafts-matrix.tar.gz`, SHA-256
`c0b5051a8c3092227b76e364ec0170411e93728ea552b58362907cd6164a30ea`.
Debug evidence is `jedit-388-drafts-debug.tar.gz`, SHA-256
`4870e222f3e735aeee50812c4e13ee10cf8477a4aff2dc61cd36be35cf0c6023`;
optimized evidence is `jedit-388-drafts-release.tar.gz`, SHA-256
`e4d522975b628ec0c83cb8bb96dcccef998ca624f27d4b63b2d420a8238757c4`.
Complete archive membership, source bytes and exported hashes are verified
before reclaiming duplicate expansions. Verbatim diagnostics remain outside Git.

## The separate lawpack boundary

`missing-draft-lawpack.edict` uses the supported version-1 profile for a small
intent and also imports `jedit.text@2` without a digest, just as the drafts do.
It reaches Target lowering, which reports `UndigestedCoreImport` for
`jedit.text@2`. Earlier source/Core passage is inferred only from the inspected
compiler's command order. Provider, verifier and runtime remain unreached.

That diagnostic is an undigested-import refusal, not a successful lookup or a
compiler diagnostic proving the absence of every possible version-2 lawpack.
The selected application configuration and retained publication provide only
`jedit.text@1`. This checkout has no version-2 authoring/publication input to
supply. Consequently the version-2 dependency requirement remains unresolved;
neither the earlier parser errors nor the small import probe establishes a
usable whole-draft lawpack closure. No version substitution is made.

## Ownership and next boundary

[Jedit #296](https://github.com/flyingrobots/jedit/issues/296) owns the authored
draft and its version-2 application contract. The first parser refusals are
concrete source-maintenance evidence; they do not require implementing every
proposed syntax form. In particular, the supported variant/fold probes leave
an iterative alternative available for investigation.

[Amblicit #260](https://github.com/flyingrobots/amblicit/issues/260) owns canonical
identity inputs; [#261](https://github.com/flyingrobots/amblicit/issues/261) owns
the broader variant/Option surface; [#262](https://github.com/flyingrobots/amblicit/issues/262)
owns bounded recursive variants. [Echo #926](https://github.com/flyingrobots/echo/issues/926)
owns the required typed-edge/guided-closure read capability. None of these is
closed or newly scheduled from the draft's first parse failure. The
[upstream reconciliation](upstream-status.md) distinguishes their existing
progress from remaining operation requirements.

Structured effect emission, composite iterative shapes, a usable version-2
lawpack publication, full application gates and independent review remain.
The forty-case ReplaceRange acceptance count is still 0/40.
