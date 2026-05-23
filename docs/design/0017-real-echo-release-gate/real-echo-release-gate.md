# Real Echo Release Gate

Status: active cross-repo gate.

Echo `v0.1.0` is delayed until jedit works on Echo. This document records what
that means from the jedit side.

## Claim

jedit proves Echo is buildable when a clean jedit checkout can run a documented
real Echo witness that uses jedit-owned contracts and generated artifacts:

```text
jedit-authored structural-history SDL
-> Wesley generated artifacts
-> Echo package install
-> jedit app submits canonical edit intent
-> trusted Echo host stages work and authorizes scheduler opportunities
-> Echo scheduler emits tick receipts
-> jedit observes applied, rejected, or obstructed outcome
-> jedit queries bounded text reading
-> retained receipt and reading evidence can be inspected
-> replay reproduces the same result
```

The test must run from this repository. Echo's in-repo hot-text-shaped fixture
proves generic mechanics, but it does not prove the external product seam.

## Product Model

The app-facing boundary is `TextBufferOptic`, not raw Echo coordinates.
`ReadBasisHandle` is an opaque supporting token issued through that optic. The
release witness should preserve the current data-model rule:

```text
The app may hold the optic.
The app may invoke the optic.
The app may not inspect the optic's runtime coordinates.
```

Runtime-facing handlers may use worldline ids, head ids, and scheduler
coordinates below the optic boundary. App-facing jedit code may not.

## Current Blocker

The current opt-in real Echo WASM witness now has a local app/host split. The
next blocker is to move from the old stack-witness fixture shape toward a
jedit-owned generated contract path with retained evidence and replay.

The previous rejection remains important doctrine: Echo should reject scheduler
`start` / `until_idle` control through app-facing dispatch. jedit must preserve
that authority boundary while improving the witness.

## Required Authority Split

jedit application code may:

- submit canonical intent bytes;
- observe intent outcomes;
- request bounded readings through opaque handles;
- render product-shaped readings and evidence summaries.

Trusted Echo host code may:

- install generated contract packages;
- stage ticketed runtime ingress;
- record trusted runtime-control commands such as Start, Stop, cadence, or
  drain policy;
- run scheduler passes;
- choose until-idle or cadence policy;
- recover faulted heads or runtime posture.

jedit application code must not:

- tick Echo;
- start or stop Echo through app intent dispatch;
- send scheduler control through app dispatch;
- access worldline ids, heads, or scheduler internals;
- treat raw transport arrival as semantic Echo history;
- forge read basis handles.

## Passing Witness

The first passing real Echo witness should prove:

- one edit-like mutation with non-trivial vars;
- one bounded text reading;
- `TextBufferOptic` or its generated successor as the app-facing capability;
- product-shaped text result plus Echo `ReadingEnvelope` evidence;
- retained receipt and reading evidence;
- replay of the same result;
- at least one non-happy path such as unsupported operation, lawful rejection,
  obstruction, residual reading, or missing retention.

## Non-Goals

- Do not build the full editor on Echo in this slice.
- Do not make Echo know jedit product nouns.
- Do not make jedit app code know Echo substrate coordinates.
- Do not remove the fake transport harness before the real witness is stable.
- Do not route around Wesley with a permanent hand-authored protocol.
- Do not bring Continuum into the local witness.

## Immediate Work

1. Keep the fake Echo-shaped harness as the stable app-facing contract.
2. Keep the real Echo witness path on separate app and trusted-host adapters.
3. Prove `create/replace/read` with retained evidence.
4. Add an agent-friendly CLI witness before adding an MCP wrapper.
5. Add replay proof before accepting the gate.
