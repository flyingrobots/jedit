# Echo-Backed TextBufferSession Port

Status: implemented local boundary.

## Claim

jedit can expose a `TextBufferSessionPort` that returns app-facing
`TextBufferOptic` buffer capabilities while keeping the trusted Echo lifecycle
port behind adapters.

This slice is a local integration step toward the release-gate sentence:

```text
jedit is powered by Echo.
```

It does not claim that every interactive editor action is already backed by
real Echo. It proves the product-facing session boundary can be wired as:

```text
TextBufferSessionPort
-> TextBufferOptic mutation
-> app-safe jedit/Echo optic client
-> trusted host loop may drain Echo independently
-> later bounded read
```

## Implemented Shape

The app-facing port is:

```text
src/ports/text-buffer-session.ts
```

The reusable app implementation is:

```text
src/app/text-buffer-session.ts
createTextBufferSession(client)
```

The Echo-backed adapter is:

```text
src/adapters/echo-backed-text-buffer-session.ts
createEchoBackedTextBufferSession({
  client,
})
```

Mutation methods call only the app-safe client:

- `openTextBuffer`;
- `createBufferWorldline`;
- `replaceRangeAsTick`;
- `createCheckpoint`.

Read methods also remain app-safe and do not request lifecycle control:

- `worldlineSnapshot`;
- `textWindow`.

## Authority Rule

The returned `TextBufferSessionPort` and `TextBufferOptic` do not expose:

- `requestRunUntilIdle`;
- `tick`;
- raw trusted control bytes;
- scheduler status internals.

The lifecycle object stays in the host-owned adapter layer and is not called by
app-facing dispatch. Application code still sees only the product capability.

## Why This Is Transitional

The current `JeditOpticClient` still returns mutation results synchronously for
the fake Echo-shaped transport and the transitional app-owned runtime. Real Echo
will eventually separate:

```text
accepted intent
-> trusted host loop drains Echo independently
-> outcome observation
```

This slice does not pretend that product-facing outcome observation is finished.
It keeps the lifecycle boundary outside app-facing dispatch so the next slices
can replace fixture behavior without changing the app authority model.

## Evidence

- `Echo-backed TextBufferSession port does not request lifecycle during app-facing dispatch`
- `trusted Echo lifecycle port requests run-until-idle without exposing tick injection`
- `transport-backed optic client exercises the fake Echo host through encoded bytes`

## Non-Goals

- No app-facing lifecycle method.
- No direct Echo tick method.
- No durable replay.
- No retained evidence lookup.
- No interactive TUI cutover in this slice.
- No jedit nouns in Echo.

## Next Work

The next integration step is now recorded in
`../0022-agent-echo-powered-session-witness/agent-echo-powered-session-witness.md`.
It binds this powered session into a host-owned runtime path that can be
exercised from an agent/CLI command:

```text
create buffer
-> submit replace-range
-> request lifecycle
-> observe text window
-> report outcome + reading evidence
```
