# jedit Vision

`jedit` is a terminal-first editor whose editing surface stays quiet while its
runtime truth becomes causally explicit.

The product goal is not to build an IDE-shaped terminal app. The goal is an
editor that feels direct and small at the surface, while every meaningful edit,
read, projection, and future undo path can be explained by deterministic
runtime evidence.

## North star

`jedit` should make causal editing usable.

The user should experience:

- a fast keyboard-first editor
- clean text and Markdown workflows
- minimal chrome
- strong Vim-shaped editing semantics
- structural intelligence when it helps
- reliable answers to "what am I seeing?" and "why did this edit happen?"

The stack should provide:

- contract-shaped edits
- deterministic admission
- evidence-bearing readings
- bounded observation apertures
- reproducible transport boundaries
- undo as authored counter-history, not deletion
- debug surfaces that can explain the causal path

Users should still experience ordinary undo semantics. The causal model exists
to preserve explainability and replayability below the product boundary, not to
make editing feel like operating a ledger.

## Product pressure

Product pressure determines architecture truth.

The stack advances only when a real editor constraint forces a seam to become
honest. `jedit` exists to apply that pressure. New runtime abstractions should
emerge from witnessed editor requirements, not speculative protocol expansion.

This is why the first serious proof is small:

```text
createBuffer
-> replaceRange("hello")
-> textWindow(0..5)
```

One witnessed editor story is worth more than a generalized protocol that no
product path has forced into existence.

## Current checkpoint

The first cross-stack truth was Stack Witness 0001:

```text
createBuffer
-> replaceRange("hello")
-> textWindow(0..5)
-> ReadingEnvelope + QueryBytes("hello")
-> TextWindowReading
```

This is intentionally small. It proves the first editor/runtime seam without
turning the repo into protocol theater.

The next checkpoint is stronger: jedit is now the release gate for Echo
`v0.1.0`. Echo is not considered ready to build with until this repository can
run a real Echo witness for a contract-backed edit, scheduler-owned tick,
observed outcome, bounded text reading, retained evidence, and replay.

The current stack posture is:

- Wesley publishes the fixture artifact shape.
- Echo hosts the fixture runtime path and owns the WASM package export boundary.
- jedit consumes the seam through a fake transport and an opt-in real Echo WASM
  witness.
- jedit now keeps read coordinates behind `TextBufferOptic` and an opaque
  `ReadBasisHandle`.
- Continuum remains intentionally untouched until the local product/runtime seam
  is proven enough to publish as a shared protocol family.

The opt-in real Echo WASM witness now preserves the required authority split:
application code submits and observes, while trusted host code owns scheduler
control. The witness also reports inline reading evidence, missing durable
retention posture, and replay obstruction posture. The next pressure is not
tick authority; it is replacing those honest obstructions with generic retained
refs, durable replay, and a jedit-owned generated contract path.

## Boundary doctrine

`jedit` is the consumer, not the substrate.

App-facing jedit code should not know about:

- worldline ids
- basis refs
- heads
- ticks
- strands
- scheduler mechanics
- Echo root derivation
- fixture-only runtime coordinates

Those belong below the optic/session adapter boundary.

App-facing jedit code may know about:

- buffers
- ranges
- selections
- modes
- panes
- panels
- lenses
- `TextBufferOptic`
- `ReadBasisHandle`
- product-shaped readings such as `TextWindowReading`

The durable direction is:

```text
open buffer/session
-> receive TextBufferOptic
-> request bounded text window through its opaque read basis handle
-> receive product-shaped reading plus evidence-bearing runtime envelope
```

The handle is not the basis. `TextBufferOptic` is the app-facing capability;
`ReadBasisHandle` is an opaque supporting token that lets the session resolve
the correct basis below the app boundary.

## Echo relationship

Echo owns causal substrate truth.

`jedit` should submit intent and observe readings. It should not reach around
Echo into runtime internals.

The Echo boundary should eventually feel boring:

- package is versioned
- byte ABI is documented
- scheduler/materialization behavior is explicit
- session bootstrap is explicit
- optics own basis resolution
- app code never derives root worldline lore

The current real WASM witness is a necessary bridge, not a public contract. It
exists to keep pressure on the byte ABI until Echo provides a durable package
and session bootstrap. It may report `missing_retention` or
`durable_replay_unavailable`; those are release-gate blockers, not acceptable
v0.1.0 end states.

## Wesley relationship

Wesley owns deterministic contract artifact generation.

The current Stack Witness fixture uses human-readable fixture bytes so the seam
can be inspected. Those bytes must not fossilize into doctrine.

The durable target is Wesley-generated binary codecs shared by Rust and
TypeScript, plus generated helpers for intent and observation shapes.

`jedit` should consume generated helpers when they are ready. It should not
invent parallel protocol shapes because doing so makes drift invisible.

## Graft relationship

Graft provides structural intelligence, not editing truth.

Graft should help with:

- syntax spans
- outlines
- fold regions
- structural selection
- diagnostics
- rename previews
- structural diffs
- semantic summaries

Echo should own causal text history.

`jedit` owns the editing experience that composes those engines into a coherent
product.

## Execution sequence

Near-term work should stay narrow:

1. Keep Stack Witness 0001 green across the fake transport.
2. Keep the real Echo WASM witness on an app/host split:
   application submits and observes, trusted host ticks.
3. Keep the witness report honest about inline evidence, missing retained refs,
   and replay obstruction.
4. Graduate `TextBufferOptic` and `ReadBasisHandle` into a real optic/session
   bootstrap contract.
5. Move remaining fixture-only basis lore below a durable session boundary.
6. Consume an Echo-owned versioned WASM package artifact.
7. Replace hand-authored fixture assumptions with Wesley-generated helpers.
8. Add editor semantics only when they are pulled by the causal seam:
   `createBuffer`, `replaceRange`, `textWindow`, then undo as inverse history.
9. Bring Continuum in only after the local jedit/Echo boundary is proven enough
   to publish without speculative ontology.

## Non-goals right now

- Do not build a full editor feature set before the causal seam is real.
- Do not make Echo know jedit product nouns.
- Do not make jedit know Echo substrate coordinates.
- Do not publish packages just because the witness ritual works.
- Do not route around Wesley with permanent hand-authored protocol shapes.
- Do not bring Continuum in to bless an unproven boundary.
- Do not implement collaboration before one local causal file history is honest.

## What jedit is not

- Not a CRDT research toy.
- Not a blockchain editor.
- Not an IDE framework.
- Not a protocol-first product.
- Not a distributed-systems demo pretending to be an editor.
- Not a place for runtime abstractions to look impressive before the product has
  forced them to be useful.

## Operating sentence

A jedit reading is legitimate when the app can show useful text and the stack
can explain the basis, law, aperture, and evidence that made the reading true.

Plainly: the user sees text, and the runtime can explain why that text is the
right text to show.
