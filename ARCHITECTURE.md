# Architecture

`jedit` is a terminal-first editor with strict hexagonal boundaries.

The broader project doctrine is written down in
[docs/design/project-invariants.md](docs/design/project-invariants.md).

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

- Generated contract packages
  The current compatibility corridor is authored in GraphQL, compiled to Rust
  bindings and contract-host helpers by Echo's Wesley extension, and registered
  with Echo by Jim's trusted native host. This is migration evidence, not the
  target application boundary. The target is Jim-authored Edict source compiled
  through Edict's public application-build boundary into a verified generic
  Echo package. Generated clients are codecs and transport stubs; they may not
  contain Jim's command interpretation or operation-selection logic.

## Target Ownership

The final application is Jim authored in Edict and realized by Echo:

- Jedit, Bijou, and native adapters are Jim's body. They decode terminal and
  process input into canonical events, install or address verified packages,
  transport opaque runtime artifacts, and render disposable projections.
- `Jim.edict` is Jim's mind. It owns editor state, modes, operators, motions,
  cursor and selection policy, registers, pending actions, input-event
  interpretation, observation requests, application intents, and outcome
  handling.
- Jim-owned Edict lawpacks own application operations and optics such as
  `ReplaceRange`, `CreateBuffer`, `DeclareCheckpoint`, and `TextWindow`, plus
  their fact schemas, identities, results, and typed obstructions.
- Edict owns source checking, Core IR, authority and lawpack closure, target
  lowering, package construction, and structurally separate verification.
- Echo owns only generic runtime authority: installation, admission, budgets,
  scheduling, bounded program interpretation, atomic ticks, WAL, receipts,
  readings, recovery, and evidence.
- Graft owns structural intelligence and projections over bounded readings. It
  has no Jim text authority and does not justify application vocabulary in Echo.

Echo production code must never branch on or implement Jim/Jedit nouns or
verbs. In particular, Echo has no `ReplaceRange` variant, rope intrinsic,
`Buffer` or `TextWindow` semantics, native Jim planner callback,
`MutationPlan`, or caller-authored graph patch. Application coordinates may be
carried opaquely in packages, fixtures, and receipts.

## Non-Negotiables

- One file, one runtime truth.
- No file over 500 LOC.
- No `any`.
- No `unknown`.
- No magic strings or magic numbers in behavioral logic.
- No stringly state machines in core logic.
- Runtime objects must carry meaning immediately after boundary decode.
- No ambient path/host/user/machine values in hashed payloads.

## Runtime First

Compile-time types are not a substitute for runtime truth.

- External input is untrusted until decoded at the adapter boundary.
- Domain code works with validated runtime objects only.
- Invalid states should be rejected early, not threaded through the system as loose primitives.

## Contract Authority

Jim-owned Edict source is the executable application law. A schema, oracle,
compiler target, and runtime receipt are distinct artifacts:

- `jedit.text.schema@1` defines application fact shapes, codecs, and identity
  rules;
- `jedit.text.ReplaceRange.oracle@1` is independent expected-behavior evidence;
- `ReplaceRange.edict` is the authored operation semantics;
- compiler-produced Echo Target IR and its verified package are executable
  meaning; and
- an Echo receipt is evidence that one admitted package ran against one basis.

Neither the schema nor the oracle is a program. Echo must not reverse-engineer
application behavior from either one. Handwritten TypeScript codecs, admission
logic, receipts, local executors, metadata-only descriptors, and handwritten
packages are forbidden substitutes.

The current narrow production corridor is:

```text
Jim command
-> typed process port
-> trusted native Echo host
-> Wesley-generated EINT binding and registered package
-> Echo-owned WAL admission and scheduler tick
-> witnessed Jim graph-rope facts and opaque Echo receipt
-> basis-pinned bounded observation
```

Only buffer creation, single-range replace/insert/delete, and bounded text-window
observation use this compatibility corridor. Checkpoint, save/export,
multi-range editing, range explanation, causal gutter readings, and undo/redo
still fail closed. Do not widen this path or mistake it for the target.

The target corridor is:

```text
terminal bytes
-> Jedit adapter emits canonical KeyEvent
-> Echo delivers the event to installed Jim.edict
-> Jim.edict requests a Jim-owned bounded optic such as TextWindow.edict
-> Echo returns a basis-bound Reading
-> Jim.edict derives an application intent such as ReplaceRange
-> Echo interprets the compiler-produced generic program
-> Echo commits one Tick or returns one typed obstruction
-> Echo delivers the outcome to Jim.edict
-> Jim advances its own state
-> Jedit renders the returned disposable projection
```

The GraphQL/Wesley package is a deliberately narrow compatibility path until
the active-observer corridor replaces it. Do not restore the deleted Node-host
Wesley projections, local runtime, or local storage authority.

## Identity Doctrine (Locked)

Runtime identity follows the locked doctrine in
[docs/design/echo-identity-doctrine.md](docs/design/echo-identity-doctrine.md):

- **Values** (`ContentRef`, `RecordRef`) are content-addressed.
- **Things** (`WorldlineId`, `SessionId`, `AnchorId`, `NamespaceId`, `BindingId`)
  are declared IDs.
- **Names** are bindings and stay in local/policy resolution layers.
- **Views** are Basis specs used for observation, not storage units.
- **WSC transport** carries selected records + binding hints and does not rewrite
  canonical payload bytes.

Import policy for transported history is explicit:
`inspect` (default), `fork`, or `adopt`.
That policy must be represented in binding metadata so behavior survives reopen.

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
  An open document and its editing state. In the long-term design, a buffer
  points at an Echo-backed rope-worldline head and uses that as editable
  truth.

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

## Graft Integration Posture

Graft is a major adapter for `jedit`, but it is not the editor kernel.

What Graft should own:

- structural projections over dirty in-memory buffers
- syntax spans for source highlighting
- fold regions
- parser-backed diagnostics
- cursor-node lookup and parent context
- structural selection growth and shrink
- symbol occurrences and rename preview
- structural diff, semantic summary, and anchor-affinity style snapshot mapping

What `Jim.edict` should own:

- buffer lifecycle over Echo-backed rope heads
- cursoring, selection state, and undo/redo over edit groups grounded in ticks
- edit-group and undo policy over ticks
- Vim-shaped mode semantics and input interpretation
- observation requests, operation intents, and outcome handling

What Jedit/Bijou/native adapters should own:

- panes, panels, focus, and lens lifecycle
- terminal decoding, process bootstrap, raw I/O, and rendering
- file import/export adapters invoked under Jim-authored policy
- paint decisions and terminal-specific rendering

Why the boundary exists:

- Graft's `StructuredBuffer` surface is an immutable parsed snapshot over
  `path + content`, which is excellent for language intelligence but not a
  substitute for an editor runtime.
- `jedit` still needs a lawful text-edit kernel with explicit tick-grounded
  history, stable anchors, and eventually a persistent piece-rope worldline.
- Structural projections and causal text truth are related, but they are not
  the same layer.

The intended stack is:

- `jedit` core owns editing interaction and buffer lifecycle over causal text
  frontiers
- Graft provides structural intelligence and parser-backed projections
- Echo / `echo-text` owns the native causal text substrate
- Echo persistence owns durable causal history
- filesystem remains a working projection boundary
- Git remains an ecosystem projection and compatibility export

`jedit` should therefore compose Echo and Graft directly. A future Graft
implementation may use Echo internally, but `jedit` should not have to route
canonical editor truth through Graft to reach its own causal substrate.

The transport used to reach Graft is not architectural truth. The current MCP
path is an implementation detail, not a long-term ownership claim.

## Testing Rule

Tests are executable spec.

- Red first for new behavior or bugfixes.
- App and domain tests should assert behavior through ports.
- Adapter tests should assert boundary decode/encode and transport behavior.
- Quality rules are allowed to ratchet through executable checks even before the repo is fully compliant.
