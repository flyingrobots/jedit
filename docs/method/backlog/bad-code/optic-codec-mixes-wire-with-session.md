---
title: optic-codec-mixes-wire-with-session
lane: bad-code
owner: jedit transport
priority: high
keywords:
  - transport
  - codec
  - architecture
  - wire-protocol
  - session-lifecycle
---

# `JeditIntentRequest` mixes wire data with client-side session

## Where

- `src/adapters/jedit-echo-optic-codec.ts` — defines
  `JeditIntentRequest` discriminated union
- `src/adapters/installed-jedit-contract-echo-transport.ts` —
  decodes from JSON, dispatches handlers
- `src/app/jedit-contract-mutation-handlers.ts` — handlers read
  `request.session`

## Smell

`JeditIntentRequest` carries `session: JeditWorldlineSession` for
`replaceRangeAsTick` and `createCheckpoint`. The session is the
client-side cache of worldline state — `worldline`, `state`,
`tickMetadata`, `checkpointMetadata`.

The session belongs to the optic client. The wire (what flows
through `submitIntentBytes`) belongs to the transport. Mixing them in
one type means:

- You cannot ship `JeditIntentRequest` over a real WASM transport
  (the engine has no session concept)
- The in-process transport is the only valid receiver because it can
  read the session field directly
- Every transport implementation has to know about jedit's
  session-tracking strategy

## Why it matters

This is exactly what blocked the Phase 5 wire swap during the
2026-05-28 0024 codec work. The EINT envelope can only carry
`(op_id, encoded_input_bytes)` — session has no place there. So
"swap encoder for encoder" can't happen without also restructuring
how sessions reach handlers.

## Suggested refactor (slice B of the EINT cutover)

1. Add `JeditWorldlineSessionPort` (in-memory map of worldlineId →
   session)
2. Optic client registers session on the port before each call
3. Transport unpacks EINT → `(opId, vars)`, decodes `vars` → input,
   looks up session via the port using `input.worldlineId`
4. Drop `session` from `JeditIntentRequest`; treat the type as a
   pure transport-side dispatch shape

## Side benefits when done

- `encodeJsonIntentRequest` / Zod schemas covering session structure
  become unreachable code — net deletion
- Sets up Phase 4 (optic client async): the session port is also the
  natural place for request-correlation state and lifecycle hooks
- Real WASM transport gains parity with in-process transport

## Surface when

Starting the EINT cutover for the optic client. There's a Think
handoff entry from 2026-05-28 that walks through the change in
detail — see `[[handoff-1780002453726]]`.
