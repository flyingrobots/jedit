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

## Editor Vocabulary

These words are not interchangeable:

- Buffer
  An open document and its editing state. Buffers are the editable truth.

- Pane
  A visible interactive region in the terminal layout. The main editor is a
  pane. Side surfaces may also be panes when visible.

- Panel
  An auxiliary pane that is hidden by default and opened intentionally, such as
  file browsing or Graft.

- Lens
  An alternate view over the active buffer. A lens does not create a second
  buffer. Preview, diff, and similar read models belong here.

## UX Invariants

- The default layout is one main editor pane with minimal chrome.
- The header has one job: identify what the main pane is showing.
- The footer’s line 1 is owned by the focused surface and may show mode, chord
  state, prompt state, or local interaction hints.
- The footer’s line 2 is reserved for slower workspace and buffer truth.
- Hidden panels do not consume space, focus, or attention.
- `tab` cycles focus only across visible interactive panes.
- Panel visibility is explicit. A panel-opening chord should also close that
  same panel.
- The main editing experience must remain readable and calm even when richer
  surfaces exist around it.
- Preview and structural inspection surfaces are projections over buffer truth,
  not competing sources of truth.
- If a surface is stale relative to the buffer, the staleness must be visible.

## Testing Rule

Tests are executable spec.

- Red first for new behavior or bugfixes.
- App and domain tests should assert behavior through ports.
- Adapter tests should assert boundary decode/encode and transport behavior.
- Quality rules are allowed to ratchet through executable checks even before the repo is fully compliant.
