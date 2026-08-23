# ReplaceRange Edict application

This directory is the Jedit-owned application root for issue #296. It keeps
five artifact classes separate:

- `edict.lawpack.json` is the reviewable `jedit.text@1` authoring input;
- `vendor/jedit-text/` is Edict's canonical published lawpack closure;
- `src/ReplaceRange.edict` is the application-owned source;
- `.build/` contains disposable provider and compiler outputs;
- `contracts/jedit/lawpacks/replace-range-v1/` remains the independent schema
  and oracle corpus and is not executable input.

## Current executable boundary

The checked-in source is the first compiler-pressure slice, not a completed
text mutation. It binds bounded identity bytes, the selected basis, range,
replacement bytes, operation profile, budget, imported helper implementation,
and a pure conditional into Edict Core. It intentionally does not claim to
traverse or rewrite a rope yet.

The public application build currently reaches Edict Target IR lowering and
fails closed because the selected generic target profile cannot lower the Core
`let` nodes emitted for the digest-bound helper and conditional. No package is
emitted and Echo is not invoked. That failure is the routing evidence required
by #296: the next owner is Edict's generic Core-to-Target-IR boundary, not Echo
and not a native Jedit planner.

## Reproduce

The build script requires exact local Edict and Echo checkouts:

```bash
EDICT_REPO=/path/to/edict \
ECHO_REPO=/path/to/echo \
  ./edict/replace-range/tests/build.sh
```

The script first republishes `jedit.text@1` through Edict's public lawpack
authoring boundary, then copies Echo's checked provider package into the
disposable application build tree and invokes Edict's public application build.
Until the generic lowering gap is implemented, it requires the stable
`TargetLoweringFailed` refusal and rejects accidental package emission.
