# Architecture

`jedit` is a terminal-first editor with strict hexagonal boundaries.

## Layer Rules

- `src/domain`
  Runtime truth only. Entities, value objects, invariants, domain services.
  No Node APIs, no Bijou, no MCP SDK, no filesystem calls, no JSON parsing.

- `src/app`
  Use cases and orchestration over domain types.
  Depends on domain plus ports, never on concrete adapters.

- `src/ports`
  Interfaces for external capabilities.
  Ports describe typed runtime contracts. They do not decode raw payloads.

- `src/adapters`
  Concrete implementations for filesystem, MCP, Bijou integration, persistence, and process boundaries.
  Raw strings, JSON, bytes, terminal events, and MCP payloads are decoded here and re-encoded here.

- `src/ui`
  Presentation and input mapping.
  UI translates Bijou events into app commands and renders app state into surfaces.
  UI does not own business rules.

## Non-Negotiables

- One file, one runtime truth.
- No file over 500 LOC.
- No `any`.
- No `unknown`.
- No magic strings or magic numbers in behavioral logic.
- No stringly state machines in core logic.
- Runtime objects must carry meaning immediately after boundary decode.

## Runtime First

Compile-time types are not a substitute for runtime truth.

- External input is untrusted until decoded at the adapter boundary.
- Domain code works with validated runtime objects only.
- Invalid states should be rejected early, not threaded through the system as loose primitives.

## Dependency Rule

Dependencies point inward:

- UI -> app
- adapters -> ports
- app -> domain and ports
- domain -> nothing external

Concrete adapters are injected into app services. No hidden singleton reach-through for new code.

## Testing Rule

Tests are executable spec.

- Red first for new behavior or bugfixes.
- App and domain tests should assert behavior through ports.
- Adapter tests should assert boundary decode/encode and transport behavior.
- Quality rules are allowed to ratchet through executable checks even before the repo is fully compliant.
