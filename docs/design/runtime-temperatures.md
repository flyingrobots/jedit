# Runtime Temperatures

`jedit` should treat its causal runtime as a temperature stack rather than one
engine pretending to solve every problem equally well.

## Core law

- The rope-worldline is canonical.
- The rope-worldline advances by ticks in the hot layer.
- The AST worldline is derived.
- Git commits are durable witnesses, not the cadence of editor truth.

That means the editor must never wait for `git commit` before its live truth,
syntax surfaces, or structural context catch up.

## The stack

### Hot

Hot is the live editor layer.

This layer owns:

- the canonical editable rope-worldline
- ticks as the canonical hot-worldline boundary
- tick receipts as the fine-grained hot witness surface
- anchors
- strands later

`jedit` may layer edit groups and undo groups over ticks, but those groupings
must not be confused with the canonical worldline boundary.

Properties:

- updates at tick cadence on every admitted logical text mutation
- parser-independent
- valid while dirty, malformed, or unsupported
- optimized for low-latency editing

The intended long-term owner of this layer is Echo or an `echo-text` style text
runtime. `jedit` consumes it as editor truth.

### Warm

Warm is the live structural projection layer.

This layer owns:

- syntax spans
- fold regions
- diagnostics
- node lookup
- structural selections
- rename preview
- structural diff and semantic summary
- structural anchor-affinity style mapping between snapshots

Properties:

- follows the current rope head or tick head
- updates at edit / tick / idle cadence rather than commit cadence
- remains truthful about partial parses and unsupported languages

Graft is the right engine for this layer. It should interpret current buffer
truth, not replace it.

### Cold

Cold is the durable witness layer.

This layer owns:

- Git-grounded repo artifact history
- commit-anchored AST worldlines
- long-horizon provenance
- durable interop and replay witnesses

Properties:

- durable
- asynchronous
- allowed to lag behind hot editing truth
- optimized for witness, history, and transport rather than keystroke latency

`git-warp` is the right substrate for this layer.

## Ownership split

- `jedit`
  Owns product behavior, modes, buffers, panes, panels, lenses, save/open
  flows, edit-group and undo policy over ticks, and rendering policy.
- Echo / `echo-text`
  Owns hot rope-worldline truth, ticks, tick receipts, and anchors.
- Graft
  Owns warm structural intelligence over rope heads.
- `git-warp`
  Owns cold durable witness and Git-native causal history.

## Retention horizons

Not every causal layer should live forever.

### Tick receipts

- finest-grained hot witness emitted from materialized ticks
- useful for the active session and short-horizon replay
- compactable
- not durable forever by default

### Ticks

- canonical hot-worldline history
- should survive saves
- may survive editor restart for recent work

### Edit groups

- typing bursts
- paste and delete actions
- accepted suggestions
- explicit structural transforms

These are editor-facing groupings over one or more ticks. They are the main
human-meaningful edit history surface.

They should outlive individual saves and likely survive editor restart for
recent work.

### Checkpoints and admissions

- save checkpoints
- explicit bookmarks
- explicit admissions
- session-close continuity points

These are the durable long-horizon history layer. They may persist much longer
than raw receipts and form the bridge into colder witness layers.

## Design consequences

- Save is a checkpoint, not a reset.
- The AST follows the rope; the rope does not wait for the AST.
- Git commits anchor or witness editor truth; they do not define when truth
  exists.
- Tick-receipt history can be compacted without losing higher-level edit-group
  or checkpoint history.
- Unsupported or malformed buffers still have lawful hot truth even when warm
  structure is partial or absent.

## Non-goals

- Treating Graft's current parsed snapshots as the canonical editor runtime.
- Forcing Git commit cadence to act as live editor update cadence.
- Treating edit groups as the canonical hot-worldline boundary.
- Keeping every primitive keystroke forever by default.
