---
title: phase-4-and-session-port-coalesce
lane: cool-ideas
owner: jedit transport
priority: medium
keywords:
  - architecture
  - async
  - session-port
  - eint
  - lifecycle
acceptance_criteria:
  - The idea names why Phase 4 (optic client async) and the session-port refactor are one design.
  - A composition sketch shows how both land in a single coherent middleware seam.
---

# Phase 4 (optic client async) and the EINT session port are one slice

## Observation

The user's 7-phase plan for the rope codec migration treats:

- Phase 4 (mutations become Promises to model real EINT round-trip)
- Phase 5 (drop JSON wire, speak EINT + LE binary vars)
- Phase 6 (`requestRunUntilIdle()` lifecycle wiring)

as three separate phases. Architecturally they want to land together.

## Why

The structural change required by Phase 5 (per
[[optic-codec-mixes-wire-with-session]]) introduces a
`JeditWorldlineSessionPort` — a per-worldline lookup so the transport
can resolve sessions from `worldlineId` after EINT decode. That port
is also the natural seam for:

- **Async correlation** (Phase 4): the optic client doesn't have an
  immediate response; the port tracks pending requests by some
  correlation id; the response arrives later and the port resolves
  the matching Promise.
- **Lifecycle hooks** (Phase 6): `requestRunUntilIdle()` is "drive
  the scheduler until the in-flight requests have settled" — the
  port already knows what's in-flight.

If we build the session port for Phase 5 alone, we'll likely build it
synchronously, then bolt async on top in Phase 4, then bolt lifecycle
on top in Phase 6. Three bolt-ons compound into the wrong shape.

## Sketch

```ts
interface JeditOpticTransportSeam {
  // Register before dispatch, retrieve from transport side
  registerSession(session: JeditWorldlineSession): void;

  // Dispatch returns a Promise; correlation id is internal
  dispatchEint(bytes: Uint8Array): Promise<Uint8Array>;

  // Lifecycle: resolves when all in-flight requests settle
  requestRunUntilIdle(): Promise<void>;
}
```

One port. One seam. All three phases land at once.

## Risk

Bigger atomic refactor. Higher chance of mid-flight regressions. But
the alternative (three bolt-on revisions) is worse — each one
re-touches the same files.

## Surface when

Starting slice B of the EINT cutover (see Think handoff
`[[handoff-1780002453726]]`). Pause before committing to the
single-port-sync design and consider whether async + lifecycle fit
the same seam.
