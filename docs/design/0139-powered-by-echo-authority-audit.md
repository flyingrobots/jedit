# Powered By Echo Authority Audit

Status: active note for slice 139.

Related issues:

- jedit title FPS controls are deferred in
  [#114](https://github.com/flyingrobots/jedit/issues/114).
- Bijou true keyboard-state input is deferred in
  [flyingrobots/bijou#316](https://github.com/flyingrobots/bijou/issues/316).

## Purpose

The primary product goal is that jedit is powered by Echo, not by fake local
runtime tricks that happen to look like Echo.

This note records the current authority posture before resuming the
Powered By Echo completion budget. It is intentionally narrow: it is not a new
roadmap, and it does not reopen title-screen FPS work.

## Current Truth

The production TUI no longer accepts a non-Echo text runtime profile.

- `JEDIT_TEXT_RUNTIME` may be unset or `echoHosted`.
- Any other value is rejected before the app starts.
- `createWorkspaceApp(...)` wires the workspace to
  `createWorkspaceProductionTextSession()`.
- `createWorkspaceProductionTextSession()` binds the production text session to
  `TEXT_RUNTIME_PROFILE_ECHO_HOSTED`.

The current product contract is therefore: production text behavior must pass
through the Echo-hosted session port. UI caches, cursors, selections, previews,
and save/export paths are not allowed to become authoritative text state.

## Remaining Risk

The phrase "powered by Echo" can still overclaim if the release gate treats
installed-package or fixture-local proof as equivalent to durable Echo truth.

The important seams are:

- `src/adapters/fake-echo-jedit-optic-transport.ts`
  - Test and fixture transport only.
  - Must not be reachable from the production TUI.
- `src/adapters/installed-jedit-contract-echo-transport.ts`
  - Echo-shaped installed package witness.
  - Still defaults to in-process runtime/session state when explicit ports are
    not provided.
  - Useful as an application-hosting proof, but not by itself a durable Echo
    authority proof.
- `src/adapters/in-memory-hot-text-runtime.ts`
  - App contract executor state.
  - Acceptable inside controlled witness and fixture boundaries.
  - Not acceptable as hidden product fallback.
- `scripts/jedit-echo-powered-session.mjs --replay-local`
  - Proves stable local replay posture.
  - Does not prove distributed replay, durable replay, or final release
    readiness by itself.

## Authority Rule

For the release claim to be honest, production jedit must not silently choose
local memory when Echo, WSC, retained evidence, or recovery is unavailable.

Allowed behavior:

- Submit product-owned contract intents through Echo-hosted ports.
- Materialize readings from Echo-backed evidence.
- Export jedit-owned artifacts from readings.
- Return typed obstruction when Echo authority is missing.
- Use fake or in-memory ports only in focused tests, fixture witnesses, or
  explicitly labeled local replay tools.

Forbidden behavior:

- Fall back from Echo-hosted text authority to local mutable lines.
- Hide missing Echo/WSC/retention state behind a fresh in-memory session.
- Let installed-package witnesses stand in for final durable Echo proof.
- Describe fixture-local evidence as production Echo truth.

## Next Work

The next Echo-first work should stay on the existing Powered By Echo completion
budget instead of creating a new parallel plan.

The highest-value slices are:

- Slice 127: history listing and evidence view.
- Slice 128: replay same edits, same evidence.
- Slice 129: host timing permutation proof.
- Slice 133: WSC release gate integration.
- Slice 139: authority and security audit.
- Slice 140: Powered By Echo release candidate gate.

The immediate implementation target is to turn this note into executable
release-gate checks:

- Production dependency graph does not import fake Echo transport.
- Production app construction does not create hidden direct local text
  authority.
- Installed-package witnesses identify their in-process state boundary.
- WSC-backed history and recovery witnesses fail closed instead of rebuilding
  local state.
- Release docs distinguish local replay from durable Echo replay.

## Completion Contract

jedit may claim "powered by Echo" only when:

- production startup is Echo-hosted only;
- open, edit, read, save/export, recovery, and history evidence pass through
  Echo-hosted ports;
- fake and in-memory transports are quarantined to tests or explicitly local
  witnesses;
- missing Echo evidence produces typed obstruction, not local fallback;
- the release gate proves the above with commands that can run from a clean
  checkout.
