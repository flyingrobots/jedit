---
title: sessions-migration
lane: asap
owner: jedit transport
priority: high
keywords:
  - sessions
  - transport
  - session-port
  - migration
  - eint
  - echo-0025
blocked_by:
  - echo cycle 0025 (sessions as causal contexts) — implementation phase
acceptance_criteria:
  - Jedit holds only a SessionId after migration, with no client-side cache of engine causal state.
  - JeditWorldlineSessionPort and its in-memory adapter are deleted.
  - The optic client surface uses sessionId-addressed intent submission and receives engine-emitted lifecycle events.
  - The bad-code card optic-codec-mixes-wire-with-session.md is fully resolved (not just partially).
---

# Sessions Migration

Companion to **echo cycle 0025 — sessions as causal contexts**, documented
in the Echo repository at
`docs/design/0025-sessions-as-causal-contexts/design.md`. (A cross-repo
relative-path link was avoided here because the two repositories are
separate Git roots; the path is descriptive rather than clickable.)

## Current smell

The jedit Slice B EINT cutover (commit `26a8f43`) introduced
`src/ports/jedit-worldline-session-port.ts` and its in-memory adapter as a
**scaffold**, not an abstraction. The optic client registers
`(worldlineId → session)` before each call; the in-process transport reads
from the same port after EINT decode. They cooperate by sharing memory in
the same process.

This works because the optic client and the in-process transport are
co-located. It does not work across a real WASM transport, and it forces
jedit to invent an engine-flavored concept (causal context per writer) in
client code. The bad-code card
[optic-codec-mixes-wire-with-session.md](../bad-code/optic-codec-mixes-wire-with-session.md)
named the underlying smell; Slice B addressed the surface but not the root.

Echo cycle 0025 fixes the root by making Session a first-class causal-
context node in Echo. This card tracks jedit's migration off the scaffold
once that engine surface lands.

## Desired jedit role

Jedit should be **dumber** about Session. The optic client holds a
`SessionId`, threads it through intent submission, and observes
engine-emitted lifecycle events. It does not maintain a parallel mirror of
engine causal state.

Conceptual jedit surface, post-migration:

```text
openSession(writer, primaryWorldline?) → SessionHandle
sendIntent(sessionId, intent)          → Promise<IntentReceipt>
observeReceipts(sessionId)             → AsyncIterable<Effect | Receipt>
runUntilIdle(sessionId, until)         → Promise<void>
closeSession(sessionId, mode)          → Promise<void>
```

The client may keep a UI-facing object like `EditorSession` — but as a
**handle over a SessionId**, not a second source of truth. No worldline /
state / tickMetadata / checkpointMetadata fields on the client side once
the engine owns them.

## Migration phases

### Phase M1 — Echo surface available

**Precondition:** Echo cycle 0025 implementation has shipped at least:

- `SessionId`, `PrincipalRef` types
- Session node + lifecycle events in the engine graph
- EINT envelope carrying `session_id` + `intent_id` headers
- `runUntilIdle(session, until)` engine API
- Two-stage close

### Phase M2 — Jedit dual-mode

Optic client supports both wire shapes during the cutover window:

- **Legacy mode** (current Slice B): uses `JeditWorldlineSessionPort`,
  encodes EINT without session header, transport resolves via port.
- **Session mode** (new): opens a session against Echo, encodes EINT with
  session header, no session-port involvement.

A feature flag or transport-capability detection chooses the mode. Both
specs pass during this window.

### Phase M3 — Default flip

Session mode becomes default. Legacy mode retained only for unit tests of
the legacy wire shape (kept for one release cycle to catch regressions).

### Phase M4 — Deletion

- Delete `src/ports/jedit-worldline-session-port.ts`
- Delete `src/adapters/in-memory-jedit-worldline-session-port.ts`
- Delete `src/adapters/installed-jedit-eint-bridge.ts` (the bridge's
  responsibilities — EINT decode + session lookup — belong to Echo's
  session machinery now; jedit's in-process transports go away with the
  legacy mode, since the real transport handles everything)
- Delete `EchoWasmKernelTransport.jeditSessionPort` field
- Delete legacy-mode optic client paths
- Update the bad-code card resolution status; delete it if fully clean.

### Deletion criteria

The session-port and bridge are deleted when **all** of these are true:

1. Echo's Session surface is available in the production echo-wasm-kernel
   transport (not just in-process fakes).
2. All jedit specs that exercise transport semantics pass in session mode.
3. No client-side code reads or writes the session-port outside of the
   legacy-mode code paths slated for deletion.
4. The bad-code card
   [optic-codec-mixes-wire-with-session.md](../bad-code/optic-codec-mixes-wire-with-session.md)
   has no remaining caveats.

## What becomes dumber

| Today (Slice B)                                                  | Post-migration                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Optic client maintains `JeditWorldlineSession` per worldline     | Optic client holds opaque `SessionId`                       |
| `JeditIntentRequest` carries `session: JeditWorldlineSession`    | Wire carries `session_id`; engine resolves                  |
| In-process bridge decodes EINT, looks up session, dispatches     | Engine does it                                              |
| `requestRunUntilIdle()` is a microtask stub                      | Real engine query against bounded child work                |
| Tab close = drop UI state; engine doesn't know                   | `closeSession(id, mode)` — engine emits `SessionClosed`     |
| Multi-writer scenarios indistinguishable from single-writer      | Each writer's work has a distinct lane the engine can audit |

## What remains client-local

Some state legitimately belongs to jedit and does not migrate:

- **Editor view state** — cursor positions, viewport, mode (insert /
  normal / visual), selection. Not causal. UI-only.
- **Read basis handles** (`ReadBasisHandleRegistry`) — these are opaque
  client-issued tokens that resolve to worldline coordinates at observe
  time. They are a jedit-side capability, not engine causal state.
- **Local UI session handle** — the `EditorSession` object that wraps the
  `SessionId` for the React/TUI layer to consume. It is a UI binding, not
  a duplicate of engine state.

## Impact on async correlation (Phase 4)

The current `JeditOpticClient` async surface (Slice B) returns Promises
that resolve immediately in a microtask, because the in-process transport
is synchronous underneath. Post-migration, those Promises resolve when the
engine emits `IntentReceiptIssued` for the corresponding `intent_id` —
which can genuinely defer. The client's responsibility shrinks: it
correlates response Promises by `intent_id`, full stop. Lane ordering and
causal scope are engine concerns.

## Impact on run-until-idle (Phase 6)

The current `requestRunUntilIdle()` is `await Promise.resolve()`. Post-
migration, it becomes:

```ts
await transport.runUntilIdle(sessionId, until);
```

where `until` is `'receipt' | 'quiescent'`. Jedit's text-buffer-session
will probably default to `'receipt'` for interactive flows and
`'quiescent'` for save / test / determinism paths.

## Temporary compatibility bridge

During M2, the optic client capability-detects the engine. If the engine
exposes Session surface, use it; otherwise fall back to session-port.
Capability detection should be a single boolean check against the
transport's reported kernel info — not a feature-flag environment variable
that could drift between processes.

## Cross-repo coordination

- Echo cycle 0025 must reach at least Phase M1 surface before this card
  unblocks. Track via `echo/docs/design/0025-sessions-as-causal-contexts/`.
- Wesley schema gets a Session node type as part of 0025; jedit consumes
  generated `SessionId` and related types via the existing Wesley TS
  emit path.
- The `echo-session-proto` rename (existing `up-next` card) needs to
  resolve naming-collision before jedit's generated types land, or jedit
  imports become ambiguous between "transport session" and "causal-context
  session."

## Source

This card grew out of a cross-repo design conversation rooted in the
jedit Slice B EINT cutover (commit `26a8f43`). The Echo-side design is
**0025 — Sessions as Causal Contexts**, in the Echo repository at
`docs/design/0025-sessions-as-causal-contexts/design.md`.
