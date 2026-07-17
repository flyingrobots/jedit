# Project Invariants

Status: active design doctrine

Purpose: define the non-negotiable product and architecture constraints that
`jedit` should preserve as it grows.

## One Sentence

`jedit` should be a portable, terminal-first editor with strict hexagonal
boundaries, parser-independent causal text truth, and a fast, minimal, honest
UX.

## Architecture Invariants

### 1. Strict hexagonal architecture

`jedit` should keep domain law, app orchestration, ports, adapters, and UI
separate.

- domain owns runtime truth and invariants
- app owns use cases and orchestration
- ports own typed capability contracts
- adapters own boundary decode and encode
- UI owns presentation and input mapping
- Edict packages own authored operation law
- generated Edict artifacts are consumed at boundaries, not hand-authored as
  competing runtime truth

The running app must move toward this shape over time rather than merely
documenting it aspirationally.

### Schema authority rule

Executable mutation law moves through Edict, not a handwritten TypeScript
runtime: Jim-owned operation semantics first, generated Edict package and
client second, Echo installation and execution third, and basis-pinned
observation last. Metadata without installed execution is not authority. There
is no accepted in-memory transitional executor.

### 2. Runtime truth beats type theater

Compile-time types are useful, but runtime truth is the law.

- boundary input is untrusted until decoded
- domain code must work on validated runtime objects
- invalid states should be rejected early
- projections must not pretend to be truth

### 3. Portable core

The editor kernel should not be trapped inside one host.

- core text/runtime law should not depend on Node APIs
- host-specific integration belongs in adapters
- UI policy should not leak into the text substrate
- the long-term causal runtime should be plausible across Rust, WASM, and
  TypeScript-facing environments

### 4. Parser-independent editing truth

The editable buffer must remain lawful even when:

- the file does not parse
- the language is unsupported
- the buffer is dirty or malformed
- structural readings are partial or stale
- the workspace is outside a Git repo

The AST is derived. The rope-worldline is canonical.

### 5. Honest causal strata

The repo should preserve a clear split between causal history, lawful readings,
and materialized projections.

- causal history = ticks, receipts, checkpoints, frontiers, strands, braids,
  admissions, and retained witness
- lawful readings = text windows, snapshots, syntax spans, diagnostics,
  semantic summaries, search results, and diffs
- materialized projections = filesystem working trees, Graft caches, rendered
  previews, exported Git commits, and CI artifacts

No layer should quietly impersonate another.

## Product Invariants

### 6. Fast and snappy is a feature, not polish

Latency is product quality.

- common editor actions should feel immediate
- scrolling must stay boring
- chrome and background intelligence must not make the editor feel heavy
- when in doubt, preserve responsiveness over cleverness

### 7. Minimal by default

The default experience should feel like zen mode, not like an IDE dashboard.

- panels are hidden until explicitly opened
- chrome stays sparse
- every visible surface must justify itself
- anything noisy must earn its existence

### 8. Smart edges, quiet center

The main editing area stays calm. Richer context belongs at the edges.

- header identifies the main pane only
- footer line 1 belongs to the focused surface
- footer line 2 carries slower workspace and buffer truth
- panels are tools, not furniture

### 9. Keyboard-first, Vim-shaped, not Vim cosplay

`jedit` should remain strongly keyboard-first and familiar to Vim users without
trying to become a terminal reenactment of Vim itself.

- modes matter
- chords should be consistent and composable
- panels should open and close symmetrically
- familiarity should reduce friction, not freeze the design

### 10. Honesty over convenience

If the system is stale, partial, degraded, or unsure, it should say so.

- dirty-buffer versus on-disk differences should be explicit
- unsupported language intelligence should degrade honestly
- partial parses should not masquerade as complete truth
- convenience features must not silently lie

### 11. Buffers, panes, panels, and lenses are different things

These concepts are not interchangeable.

- buffers are editable document truth
- panes are visible interactive regions
- panels are auxiliary panes hidden by default
- lenses are alternate views over the active buffer

Feature design should preserve these distinctions.

## Runtime Invariants

### 12. Save is a checkpoint, not a reset

Saving should materialize current truth and mark a checkpoint. It should not
destroy causal history by default.

### 13. Tick is the causal boundary

Echo's tick should be treated as the canonical causal-history boundary.

- `ReplaceRange` and related edit law describe what is lawful
- `ReplaceRange` operation identity and invocation come from the generated
  Edict package installed in Echo
- a tick admits lawful change into the worldline
- `jedit` may derive undo/history groupings from retained Echo evidence

Edit groups are important, but they are not the canonical substrate boundary.

### 14. Footprint schema is static, binding is dynamic

Hot rewrites should be statically honest without pretending their concrete
runtime focus is known ahead of time.

- Edict rewrite contracts should declare slots, closure operators,
  create surfaces, update surfaces, and forbidden surfaces explicitly
- runtime ids, current-head relations, rope-path closure, and anchor-closure
  membership remain dynamic bindings
- compile-time failure should cover undeclared capability use
- runtime failure should cover invalid or stale bindings

### 15. History is tiered

Not every causal artifact should live forever.

- tick receipts are short-horizon and compactable
- ticks are the canonical causal history
- edit groups are the main human-facing history surface
- checkpoints and admissions are the durable long-horizon layer

### 16. Files and previews are projections

Files on disk, Markdown preview, AST views, diagnostics, fold maps, and search
indexes are all projections over buffer truth, not separate authorities.

## Delivery Invariants

### 17. Tests are executable spec

Important behavior should become red tests before it becomes implementation
truth.

### 18. Design should become repo truth

Important decisions should land in inspectable docs, tests, and code, not live
only in chat.

Design docs define intent, but executable witnesses prove implementation.
Design-doc assertions may support evidence ledgers, but they are not sufficient
proof for product, runtime, UI, or tooling work.

### 19. Graceful degradation is mandatory

If structural readings are partial, unsupported, or stale, or if ecosystem
exports such as Git are unavailable, the editor should degrade to a smaller
truthful product instead of collapsing into confusion or pretending its
projections are complete.
