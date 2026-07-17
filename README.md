<div align="center"><h1><code>Jim</code></h1>

<img alt="Jimlogo" src="https://github.com/user-attachments/assets/7db3d40f-e91d-4585-a43b-96d1e017f46c" />

</div>

## What is Jim?

Jim is a **_Vim_**-shaped modal editor for people and agents who are tired of pretending that mutable files are the whole story.

It keeps the parts of Vim that belong in your hands — modes, operators, motions, text objects, registers, command-line workflows — and relocates the strange part beneath the floorboards. Under the visible editor lives causal history, command provenance, bounded observation, and Echo-backed text authority. Jim is not trying to become a larger Vim, a terminal IDE, or a protocol cosplay performance. It is trying to become a small, sharp editor with a memory and the decency to explain itself.

Most editors act as if the file on disk is the truth and everything else is a rumor. Jim comes from a different place. In Jim, files are materialized projections over causal history: real, useful, necessary, but not sovereign. The surface stays direct. The ontology gets weirder. The runtime can answer questions ordinary editors mostly dodge: what changed, why it changed, what evidence supports that answer, what the buffer looked like before, and whether the thing you are looking at is current head, retained history, or a bounded projection with a narrower claim.

### The post-Unix philosophy

Unix says: everything is a file.  
Jim says: files are a useful fiction, but they are not the base reality.

The point is not to force users to think about runtime substrate lore every time they type `dw`. The point is the opposite. The hands should stay calm. The semantics should stay familiar. The weirdness should be concentrated below the product boundary, where it can do actual work: preserving provenance, making history inspectable, keeping observations bounded, and making destructive edits less magical.

Many features already exist or are in the process of being dragged into honesty: graph-rope domain law, command provenance through `:why`, Graft-backed syntax highlighting and outlines, witness scripts, and a growing Jim/Vim command surface. The former local history drawer and Echo-shaped TypeScript runtime were deleted because they could not support their causal claims. Vim compatibility is preserved where it matters. If Vim is already in your fingers, Jim should feel less like a betrayal and more like a suspiciously well-behaved fork from a better timeline.

### Is this just Vim + Git?

No, [get outta here](https://github.com/flyingrobots/echo#is-this-just-git).

### How Vim-like is Jim?

See `docs/vi_diff.txt` when available, along with the design docs and parity notes, for differences from Vim.

### Should I use Jim?

Probably not yet, unless you enjoy living near the active edge of a weird — but ambitious — editor.

That said, I have started dogfooding it and pushing it toward daily-driver territory. Jim is especially useful for editing programs and other plain text where trust, auditability, and recoverability matter. All core commands use ordinary keyboard characters. The editing surface is meant to stay quiet, direct, and fast. The editor should not scream just because the runtime underneath it knows more than most editors dare to remember.

Jim aims to remain lightweight at the surface even as the machinery beneath it becomes causally explicit. The production path is Echo-hosted: application code will submit generated Edict operations and consume bounded readings, while Echo owns admission, runtime lifecycle, scheduling, receipts, and causal history. Jim already requires a real Rust/WASM Echo kernel at startup, but Echo cannot yet install and invoke Jim's generated operation package. Until it can, text operations fail closed. That split is not decorative. Jim should know editor truths, not substrate coordinates.

Jim grows out of the `jedit` repository. The product arc is Jim. The repository, packages, contracts, release gates, and internal APIs remain `jedit` until the Echo-backed proof and compatibility plan make a public rename safe. The rename should be earned the same way the rest of the editor is earned: through real product pressure, not theater.

## Distribution

Maybe one day Jim will arrive through ordinary package channels, all civilized and respectable.

For now, build it from source. Run the development scripts. Read the witnesses. Treat the repository as what it presently is: an editor, a proof harness, a design lab, and a pressure vessel for the Echo stack. If Echo cannot host a real editor without cheating, then Echo does not get to pretend it is ready.

Check out the repository from GitHub. It includes the terminal application,
command provenance projections, production cutover guards, and an honest Echo
kernel smoke witness. The former local Echo-shaped session scripts were deleted.

## Compiling

```bash
npm ci
npm run build
node dist/main.js
```

The build and witness tooling live in the repository and the `scripts/` directory. Read `GUIDE.md` for operational guidance, `ARCHITECTURE.md` for layer rules and dependency posture, `ADVANCED_GUIDE.md` for the render and authority path, and `docs/BEARING.md` for the compact statement of current truth.

Running the editor requires a real Echo WASM module. Point Jim at the module
that Echo produced:

```bash
JEDIT_ECHO_WASM_MODULE=/path/to/echo-wasm-package npm run dev
```

Jim currently initializes that kernel and then fails text operations closed
because the generated Edict operation package is not installed yet. There is
no local text-authority fallback.

## Installation

See the quickstart materials under `docs/releases/` for the current release-gate path.

At the moment, the quickstart is aimed less at “install this polished public editor” and more at “prove this Echo-backed edit/read path is real, bounded, and honest.” This is not a bug in the README. The product should earn its myths.

## Documentation

Start here:

- `GUIDE.md` — how to run, build, validate, and inspect the Echo cutover posture.
- `ADVANCED_GUIDE.md` — how the visible editor, projections, and Echo authority fit together.
- `ARCHITECTURE.md` — the layer rules, dependency graph, and product vocabulary.
- `docs/BEARING.md` — compact current truth, active roadmap anchors, and non-negotiables.
- `docs/design/` — living design specs for each major cycle.
- `docs/design/echo-identity-doctrine.md` — canonical Echo identity, scope, and transport doctrine.
- `docs/method/` — process, roadmap, release, and proof policy.
- `docs/jedit-echo-end-to-end.md` — the current jedit-plus-Echo proof path.

Inside the editor, the command surface continues to grow. The roadmap is not “become all of Vim and then add lore.” The roadmap is accountable editing through a product loop with teeth: explain, preview, admit, recover.

## Current posture

What you get right now includes:

- Vim-shaped editing with Normal and Insert behavior, plus a growing command surface.
- A real Echo WASM startup boundary; text editing currently fails closed until
  generated Jim Edict operations can be installed and invoked by Echo.
- No local history drawer or undo stack; those surfaces remain unavailable until they can read retained, basis-pinned Echo evidence.
- Graft-backed syntax highlighting, outlines, diagnostics, and structural projections where available.
- Witness scripts and JSON-reporting evidence tools for CI, agents, and release-gate work.
- Agent-oriented interfaces for bounded, inspectable editing workflows.

The current wedge is not “more editor.” It is accountable editing.

Jim is the product shape I am using to apply pressure to a broader causal computing vision. What sets it apart is that it is trying to do one thing most editors barely attempt: explain what happened in terms stronger than “because the buffer changed.” That is where `:why`, historical basis preview, proposal strands, and strand/braid/worldline UX are headed. The editor should not merely let you act. It should be able to account for the act afterwards.

This does not mean Jim currently claims full causal omniscience. It does not. Some parts of the story already exist. Some are actively being proven. Some are still roadmap. The weirdness here is intentional, but it is not supposed to be fake.

_There is no file. Only witnessed causal history and lawful, bounded optics._

## Copying

Jim is currently under active development. See `LICENSE` for the current terms.

## Contributing

Contributions are welcome, but this is not a “throw code at it until destiny reveals itself” project.

Jim follows a _strict_ design-cycle process with executable specs, quality gates, and release witnesses. Read `AGENTS.md`, `docs/method/process.md`, and the active design-cycle documents before making substantial changes.

Bug reports, design feedback, and causal UX ideas are welcome through GitHub issues and Discussions.

## Information

Latest news, design notes, and witness surfaces live in the repository. For deeper dives into provenance, worldlines, history, Echo hosting, and command explanation, start in `docs/design/` and `docs/BEARING.md`.

### Useful entry points

- `scripts/jedit-command-provenance-witness.mjs` — command provenance witness.
- `scripts/jedit-echo-kernel-smoke.mjs` — real Echo WASM boundary witness.
- `scripts/jedit-production-cutover-guard.mjs` — rejects local production
  authority and fake compatibility paths.
- `scripts/run-real-echo-wasm-stack-witness.sh` — cross-repository Echo stack
  witness.

If something goes wrong, read the relevant design docs, run the nearest witness, and then open an issue.

This is the early README for Jim: Jedit Is Modal.

---

From the mind of: `flyingrobots`.
