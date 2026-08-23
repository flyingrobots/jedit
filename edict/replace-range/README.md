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

With Edict #201, the public application build lowers those Core `let` nodes into
generic, source-ordered Target IR and independently verifies the compiler-owned
result projection. The exact Echo provider package then refuses the invocation
as `InvalidProviderInvocation` because its published adapter, target
configuration, Target IR, and result-projection contracts do not yet admit the
new generic artifact family. No executable operation package is emitted and no
Echo evaluator runs.

That refusal is the current routing evidence required by #296: Edict now
preserves the bounded pure program without learning Jedit vocabulary, and the
next owner is Echo's generic provider package and execution profile. It is not
evidence that `ReplaceRange` mutates a rope or that Jim runs end to end.

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
Against Edict #201 it requires the stable `InvalidProviderInvocation` refusal
and rejects accidental package emission. Once Echo admits this generic artifact
family, the gate must advance again rather than treating provider refusal as a
permanent success condition.
