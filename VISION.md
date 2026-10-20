# jedit Vision

`jedit` is a terminal-first editor whose editing surface stays quiet while its
runtime truth becomes causally explicit.

The product goal is not to build an IDE-shaped terminal app. The goal is an
editor that feels direct and small at the surface, while every meaningful edit,
read, projection, and future undo path can be explained by deterministic
runtime evidence.

## North star

`jedit` should make causal editing usable.

The product promise Jim must earn is:

```text
Jim is a modal editor for people and agents who need edits to be explainable,
recoverable, and reviewable.
```

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

Jim should not try to win by being a larger Vim, a terminal IDE clone, a generic
AI chat surface, or full modal-editor parity alone. Those lanes make the product
interchangeable. Jim's owned lane is accountable editing: edits that can be
inspected, replayed, explained, previewed, and safely admitted.

The signature product loop is:

```text
explain -> preview -> admit -> recover
```

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

## Where the product stands

That first proof now runs through a real native Echo host: a Wesley-generated
compatibility package admits buffer creation, single-range edits, checkpoint
declarations, and bounded text-window reads, with WAL-backed restart recovery.
It is a compatibility corridor, not the target. The target runs `Jim.edict` as
an Echo-realized active observer, with application law authored in Edict.
`docs/BEARING.md` records exactly what works today and what comes next.

## Boundary doctrine

`jedit` is the consumer, not the substrate.

App-facing jedit code should not know about:

- worldline ids
- basis refs
- ticks
- strands
- scheduler mechanics
- Echo root derivation
- runtime-internal coordinates

Those stay below the production text session and the native host boundary.

App-facing jedit code may know about:

- buffers
- ranges
- selections
- modes
- panes
- panels
- lenses
- opaque head identities returned by Jim, carried as a reading's basis
- product-shaped readings such as `TextWindowReading`

The durable direction is:

```text
open a buffer
-> receive an opaque buffer identity and basis head
-> request a bounded text window at an explicit basis head
-> receive a product-shaped reading plus evidence-bearing runtime envelope
```

App code replays an opaque head identity; it never derives, inspects, or mints
one.

## Echo relationship

Echo owns causal substrate truth.

`jedit` should submit intent and observe readings. It should not reach around
Echo into runtime internals.

The Echo boundary should eventually feel boring:

- package is versioned
- byte ABI is documented
- scheduler/materialization behavior is explicit
- session bootstrap is explicit
- every reading names the basis it was taken at
- app code never derives root worldline lore

## Wesley and Edict relationship

Echo's Wesley contract-host generator produces today's compatibility package
from `contracts/jedit/echo-text.graphql`: codecs, operation identities, and host
helpers. That package is migration evidence, not the target. Jim's application
law is to be authored in Edict and compiled through Edict's public build into
verified generic Echo packages, replacing the compatibility package operation by
operation.

`jedit` should not invent protocol shapes beside either. Doing so makes drift
invisible.

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

Near-term product work should stay narrow and ordered by goalposts:

1. **Editor Trust Gate**: prove open, edit, save, quit, search, dirty-state, and
   disk-output behavior before leaning on causal UI.
2. **Command Provenance And `:why`**: expose why representative Vim edits
   changed text, which basis they used, which range they touched, and what
   receipt or result reading proves the outcome.
3. **Historical Basis Preview**: preview history through a bounded basis view
   while clearly preserving the current head.
4. **Search Sets And Substitute Strand Preview**: let search create basis-bound
   result sets, let `:%s` preview proposal strands, and let `:admit` admit all
   or selected rows.
5. **Historical Yank And Register Provenance**: reuse retained historical
   material without moving the current head.
6. **Vim Power Core**: deepen Vim parity through the causal system, prioritizing
   visual mode, registers, semantic repeat, macros, marks, structural text
   objects, and range commands.
7. **Agent-Safe Editing**: require agent edits to arrive as accountable proposal
   strands with basis, range, rationale, evidence, and admission paths.

Runtime work still follows product pressure:

- Keep Echo app/host authority split intact.
- Keep witness reports honest about what is retained, replayable, or obstructed.
- Replace the Wesley compatibility package with Edict-authored law, operation
  by operation.
- Add editor semantics only when pulled by the causal seam.
- Bring Continuum in only after the local jedit/Echo boundary is proven enough
  to publish without speculative ontology.

## Non-goals right now

- Do not build a full editor feature set before the causal seam is real.
- Do not make Echo know jedit product nouns.
- Do not make jedit know Echo substrate coordinates.
- Do not publish packages just because the witness ritual works.
- Do not prepare a public editor release until the product has a credible demo
  path for accountable editing.
- Do not invent hand-authored protocol shapes beside the generated contract or
  the Edict packages.
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
