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

See `docs/vi_diff.txt` for differences from Vim.

### Should I use Jim?

Probably not yet, unless you enjoy living near the active edge of a weird — but ambitious — editor.

That said, I have started dogfooding it and pushing it toward daily-driver territory. Jim is especially useful for editing programs and other plain text where trust, auditability, and recoverability matter. All core commands use ordinary keyboard characters. The editing surface is meant to stay quiet, direct, and fast. The editor should not scream just because the runtime underneath it knows more than most editors dare to remember.

Jim aims to remain lightweight at the surface even as the machinery beneath it becomes causally explicit. The production text path is now Echo-hosted: a trusted native process registers a Wesley-generated compatibility package, submits generated EINT envelopes through Echo's WAL-backed app capability, and consumes scheduler receipts plus bounded readings. Echo owns admission, runtime lifecycle, scheduling, graph state, receipts, and recovery. Jim currently supports only create/open, single-range editing, checkpoint declaration, and bounded text reads through that path; unsupported operations fail closed. Edict will replace the narrow compatibility package when its native invocation corridor is ready. That split is not decorative. Jim should know editor truths, not substrate coordinates.

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

The build and witness tooling live in the repository and the `scripts/` directory. Read `GUIDE.md` for operational guidance, `ARCHITECTURE.md` for layer rules and dependency posture, and `ADVANCED_GUIDE.md` for the render and authority path. [Current posture](#current-posture) below is the statement of current truth.

Running the editor builds and launches the trusted native Echo host:

```bash
npm run dev
```

If the host cannot start, text operations fail closed. There is no local
text-authority fallback. `JEDIT_ECHO_HOST_BIN` may select another compatible
binary, and `JEDIT_ECHO_WAL_DIR` may select its filesystem WAL directory.

## Installation

See [Build And Startup](docs/jedit-echo-end-to-end.md#build-and-startup) for building the native Echo host and launching the editor.

At the moment, setup is aimed less at “install this polished public editor” and more at “prove this Echo-backed edit/read path is real, bounded, and honest.” This is not a bug in the README. The product should earn its myths.

## Documentation

Start here:

- `GUIDE.md` — how to run, build, validate, and inspect the Echo cutover posture.
- `ADVANCED_GUIDE.md` — how the visible editor, projections, and Echo authority fit together.
- `ARCHITECTURE.md` — the layer rules, dependency graph, and product vocabulary.
- `docs/jim-component-ownership.md` — who owns what across Jim, Jedit, Edict, and Echo, now and in the target.
- `docs/design/` — active design documents and accepted doctrine.
- `docs/design/echo-identity-doctrine.md` — canonical Echo identity, scope, and transport doctrine.
- `docs/method/` — process, roadmap, documentation, CI, and proof policy.
- `docs/jedit-echo-end-to-end.md` — the current jedit-plus-Echo proof path.

Inside the editor, the command surface continues to grow. The roadmap is not “become all of Vim and then add lore.” The roadmap is accountable editing through a product loop with teeth: explain, preview, admit, recover.

## Current posture

This section is the repository's statement of current truth and of the order of work. Keep it current when execution gravity changes; historical implementation claims belong in Git history.

Current bearing: keep the real Wesley compatibility corridor honest, author Jim's first operation as real Edict source, and converge on `Jim.edict` as an Echo-realized active observer. Do not add editor vocabulary to Echo or move Jim's semantic state machine into a generated TypeScript client.

What you get right now includes:

- Vim-shaped editing with Normal and Insert behavior, plus a growing command surface.
- A trusted native Rust host, `jedit-echo-host`, linked to Echo. Production startup launches it; there is no TypeScript text runtime or generic WASM facade in the product text path.
- Buffer open/create, insert, replace, delete, checkpoint declaration, bounded text-window reads, scheduler receipts, and restart recovery.
- Typed obstruction for multi-range editing, save/export, range `:why`, causal line-diff, and undo/redo until those paths are Echo-owned.
- No local history drawer or undo stack; those surfaces remain unavailable until they can read retained, basis-pinned Echo evidence.
- Graft-backed syntax highlighting, outlines, diagnostics, and structural projections where available.
- Witness scripts and JSON-reporting evidence tools for CI, agents, and release-gate work.
- Agent-oriented interfaces for bounded, inspectable editing workflows.

How the text path works today:

- `contracts/jedit/echo-text.graphql` declares buffer creation, single-range replacement, checkpoint declaration, and bounded text-window observation.
- Echo's `echo-wesley-gen --contract-host` output supplies canonical EINT codecs, operation identities, registry evidence, generated rules, and the query observer plan under `native/jedit-echo-host/src/generated/`.
- The native host registers that package, submits EINT envelopes through Echo's WAL-acknowledged app capability, asks Echo's trusted host to derive installed-operation admission evidence, runs scheduler-owned ticks, and returns opaque receipt and reading identities.
- Buffer authority is an immutable graph rope stored in Echo's worldline graph. Narrow edits path-copy touched nodes and retain untouched subtree identity.
- Restart reconstructs witnessed submissions, graph state, and receipts from Echo's filesystem runtime WAL. The recovered host can continue editing.
- TypeScript currently owns the JSONL process adapter, request/result mapping, coordinate branding, and disposable UI projections. Its request mapping is explicit migration debt: in the target corridor TypeScript normalizes canonical events and transports artifacts, but has zero semantic authority to interpret commands, choose operations, derive ranges, advance Jim state, or optimistically mutate visible text.
- Jim owns `RopeCheckpointDeclared` semantics. Echo admits and schedules the generated declaration, persists its Jim fact in the graph/WAL history, and returns the opaque receipt and tick identities. Declaration validates that its basis head belongs to the stated Jim buffer worldline and does not mint a text head, rewrite, diff, or causal anchor. A Jim checkpoint declaration and an Echo causal anchor remain separate propositions; no anchor association is created automatically.
- The current package is explicitly `0.1.0-wesley-compat`. Its authored Rust operation law and process invocation seam are transitional until Edict can install and invoke the corresponding generated operations.
- Checkpoint reason remains a transitional GraphQL `String` because the pinned Wesley contract-host enum emitter produces Rust that does not compile for this enum shape. The installed native Jim contract still admits exactly `manual-save`, `autosave`, `retention-boundary`, `export`, and `import`; an arbitrary string is not an admitted checkpoint proposition.
- The full-snapshot runtime, local graph-rope executor, local admission loop, locally manufactured receipts, fake production transports, and optimistic text mutation path remain deleted.
- Test doubles are permitted only under test code and only through explicit injection. The production cutover guard scans TypeScript, executable scripts, and native host Rust for forbidden local authority.

The current wedge is not “more editor.” It is accountable editing.

Jim is the product shape I am using to apply pressure to a broader causal computing vision. What sets it apart is that it is trying to do one thing most editors barely attempt: explain what happened in terms stronger than “because the buffer changed.” That is where `:why`, historical basis preview, proposal strands, and strand/braid/worldline UX are headed. The editor should not merely let you act. It should be able to account for the act afterwards.

This does not mean Jim currently claims full causal omniscience. It does not. Some parts of the story already exist. Some are actively being proven. Some are still roadmap. The weirdness here is intentional, but it is not supposed to be fake.

### Authority boundary

The accepted production mutation corridor is:

```text
Jim command
-> Jim-owned validated request
-> Echo host process port
-> Wesley-generated EINT and installed package
-> Echo WAL-acknowledged submission
-> Echo-owned installed-operation admission
-> Echo scheduler-owned tick
-> Jim graph-rope facts + opaque Echo receipt
-> Echo bounded query observation
-> disposable Jim UI projection
```

In the target Edict corridor, Jedit normalizes physical input into one canonical event envelope with stable event, source, ordering, normalized-input, and admission coordinates. Echo admits and transports the envelope without inspecting Jim or Jedit fields. Only `jim.core`, authored from `Jim.edict`, interprets editor meaning. [Jim: Components, Responsibilities, and Ownership](docs/jim-component-ownership.md) holds the frozen ownership and causal-settlement contract.

```text
terminal bytes
-> Jedit adapter emits one canonical event envelope
-> Echo realm admits and delivers it opaquely under an exact JimRelease
-> jim.core interprets the event and durably retains any command attempt
-> jim.core requests jedit.text TextWindow.edict
-> Echo returns a basis-bound Reading
-> jim.core composes jedit.text ReplaceRange.edict
-> Echo privately evaluates one combined Jim-and-buffer candidate
-> one realm and epoch atomically settles Jim, Buffer, result, and evidence
   or retains a distinct CandidateSettlementRejected outcome
-> Jedit renders one declared causal view basis
```

A generated client may encode events, install or address verified packages, transport readings/outcomes/receipts, and decode typed projections. It is a syscall stub, not Jim. A direct generated-client invocation of `ReplaceRange` is permitted only in an explicitly test-only operation conformance harness.

### Artifact boundaries

These artifacts are intentionally not interchangeable:

| Artifact | Role |
| --- | --- |
| `jedit.text.schema@1` | Application fact shapes, codecs, and identity rules |
| `jedit.text.ReplaceRange.oracle@1` | Independent expected-behavior evidence |
| `ReplaceRange.edict` | `jedit.text`-authored operation semantics composed by `jim.core` |
| Echo Target IR and verified package | Compiler-produced generic executable meaning |
| Echo receipt | Evidence of one admitted execution against one basis |

The oracle is never a program. Echo must not synthesize an evaluator or package from the schema or oracle.

Runtime identity follows [the Echo identity doctrine](docs/design/echo-identity-doctrine.md). Jim must not copy Echo identity domains, admission policy, scheduler behavior, WAL evidence, or support-policy logic.

### Roadmap

The active goalpost is [Jim.edict](https://github.com/flyingrobots/jedit/issues/295). In order:

1. Keep the narrow create/replace/checkpoint/read corridor green against Echo-owned WAL, admission, scheduling, graph state, receipts, and restart recovery.
2. Avoid restoring broad editor feature parity through transitional APIs.
3. Author the persistent-rope `ReplaceRange.edict` in `jedit.text`, with typed outcomes. The flat-text reference is already authored, built through the pinned Edict package chain, and verified in Echo; it is the logical-text reference for the persistent-rope differential gate, not graph admission or recovery evidence.
4. Build it through Edict's public application-build boundary and let the first honest compiler or target-profile failure route work to its owning repo.
5. Extend Echo only for generic bounded-program capabilities proven necessary by the compiler-produced package; prove the result against the independent Jedit oracle.
6. Author `TextWindow.edict`, then the smallest `Jim.edict` active observer.
7. Move production Jedit to canonical event submission and disposable rendering; make frontend operation orchestration and the Wesley/native planner route unreachable, then delete them.
8. Migrate create/open and checkpoint lawpacks under the same ownership model.
9. Add optional causal-anchor association as a proposition separate from checkpoint declaration only when a concrete consumer requires it.
10. Add save/export through Jim-authored operations, then derive undo/redo candidates from retained Echo history and invoke generated inverse operations through basis-pinned Echo observations.
11. Delete the remaining compatibility host package and semantic JSONL glue; retain only raw event/artifact transport required by the final membrane.

### Hard gates

- Do not reintroduce an in-process text authority to make the TUI usable.
- Do not mutate visible text before an Echo-backed observation returns.
- Do not call local file writes a save when no Echo basis was exported.
- Do not manufacture Echo receipts, ticks, admissions, anchors, or identities.
- Do not make the UI claim causal evidence that Echo cannot return.
- Do not treat a cache, WAL mirror, queue, map, or materialization as semantic authority beside Echo history.
- Do not widen the handwritten compatibility protocol for feature parity.
- Do not describe the Wesley compatibility package as the final Edict design.
- Do not put `ReplaceRange`, rope operations, `Buffer`, or `TextWindow` semantics in Echo production code.
- Do not let TypeScript map commands to operations in final production composition.

_There is no file. Only witnessed causal history and lawful, bounded optics._

## Where Jim is going

Jim must earn this promise: a modal editor for people and agents who need edits to be explainable, recoverable, and reviewable. The editing surface stays quiet while runtime truth becomes causally explicit, so every meaningful edit, read, projection, and future undo path can be explained by deterministic runtime evidence.

The user should experience a fast keyboard-first editor, clean text and Markdown workflows, minimal chrome, strong Vim-shaped editing semantics, structural intelligence when it helps, and reliable answers to "what am I seeing?" and "why did this edit happen?"

The stack should provide contract-shaped edits, deterministic admission, evidence-bearing readings, bounded observation apertures, reproducible transport boundaries, undo as authored counter-history rather than deletion, and debug surfaces that can explain the causal path. Users still experience ordinary undo semantics: the causal model exists to preserve explainability and replayability below the product boundary, not to make editing feel like operating a ledger.

Jim's owned lane is accountable editing: edits that can be inspected, replayed, explained, previewed, and safely admitted. Its signature product loop is:

```text
explain -> preview -> admit -> recover
```

### Product pressure

Product pressure determines architecture truth. The stack advances only when a real editor constraint forces a seam to become honest, and new runtime abstractions emerge from witnessed editor requirements, not speculative protocol expansion. That is why the first serious proof was small (`createBuffer -> replaceRange("hello") -> textWindow(0..5)`): one witnessed editor story is worth more than a generalized protocol that no product path has forced into existence.

### Boundary doctrine

Jim is the consumer, not the substrate. App-facing code never knows worldline ids, basis refs, ticks, strands, scheduler mechanics, Echo root derivation, or other runtime-internal coordinates; those stay below the production text session and the native host boundary. It may know buffers, ranges, selections, modes, panes, panels, lenses, product-shaped readings such as `TextWindowReading`, and opaque head identities returned by Jim, carried as a reading's basis. App code replays an opaque head identity; it never derives, inspects, or mints one.

Echo owns causal substrate truth. Jim submits intent and observes readings without reaching around Echo into runtime internals, and the Echo boundary should eventually feel boring: a versioned package, a documented byte ABI, explicit scheduler, materialization, and session-bootstrap behavior, and a named basis on every reading.

Jim's application law is authored in Edict and compiled through Edict's public build into verified generic Echo packages, replacing the Wesley compatibility package operation by operation. Jim does not invent protocol shapes beside either, because doing so makes drift invisible.

Graft provides structural intelligence, not editing truth: syntax spans, outlines, fold regions, structural selection, diagnostics, rename previews, structural diffs, and semantic summaries. Jim owns the editing experience that composes those engines into a coherent product.

### Product goalposts

Product work is ordered by these goalposts:

1. **Editor Trust Gate**: prove open, edit, save, quit, search, dirty-state, and disk-output behavior before leaning on causal UI.
2. **Command Provenance And `:why`**: expose why representative Vim edits changed text, which basis they used, which range they touched, and what receipt or result reading proves the outcome.
3. **Historical Basis Preview**: preview history through a bounded basis view while clearly preserving the current head.
4. **Search Sets And Substitute Strand Preview**: let search create basis-bound result sets, let `:%s` preview proposal strands, and let `:admit` admit all or selected rows.
5. **Historical Yank And Register Provenance**: reuse retained historical material without moving the current head.
6. **Vim Power Core**: deepen Vim parity through the causal system, prioritizing visual mode, registers, semantic repeat, macros, marks, structural text objects, and range commands.
7. **Agent-Safe Editing**: require agent edits to arrive as accountable proposal strands with basis, range, rationale, evidence, and admission paths.

### Non-goals

- No full editor feature set before the causal seam is real.
- Echo does not learn Jim product nouns, and Jim does not learn Echo substrate coordinates.
- No packages published just because the witness ritual works, and no public editor release until the product has a credible demo path for accountable editing.
- No hand-authored protocol shapes beside the generated contract or the Edict packages.
- No Continuum to bless an unproven boundary; it comes in only after the local Jim/Echo boundary is proven enough to publish without speculative ontology.
- No collaboration before one local causal file history is honest.
- Not a CRDT research toy, a blockchain editor, an IDE framework, a protocol-first product, or a distributed-systems demo pretending to be an editor.

A Jim reading is legitimate when the app can show useful text and the stack can explain the basis, law, aperture, and evidence that made the reading true. Plainly: the user sees text, and the runtime can explain why that text is the right text to show.

## Copying

Jim is currently under active development. See `LICENSE` for the current terms.

## Contributing

Contributions are welcome, but this is not a “throw code at it until destiny reveals itself” project.

Jim follows a _strict_ design-cycle process with executable specs, quality gates, and release witnesses. Read `AGENTS.md`, `docs/method/process.md`, and the active design-cycle documents before making substantial changes.

Git hooks are plain shell scripts in `scripts/hooks/`. Hook installation is local, so merging the hooks does not install them. Enable them once per clone; linked worktrees share them. The installer writes small launchers into the repository's own hooks directory, which moves with the clone, leaves `core.hooksPath` unset, and refuses if any `core.hooksPath` setting would override that directory, if a registered worktree is unavailable to check, or if a hook slot holds anything it did not install, including a symbolic link. It puts the launchers in place before removing a legacy `core.hooksPath`, and restores that setting if any later step fails. Each launcher decides from the commit being recorded or the commits being pushed, not from the worktree's files: a hook the recorded tree or a pushed tip contains must run, from this worktree's copy, and must be recorded as an executable file (mode `100755`); a missing one is skipped only when that full history never had it, and a shallow clone, which cannot show that, is refused. So a branch cannot skip its hooks through a sparse checkout, by deleting or unstaging them, by dropping their executable mode, or by merging them away:

```bash
scripts/install-hooks.sh
```

Each hook checks exactly what Git is about to record, in a temporary detached worktree that Git checks out itself. `scripts/hooks/pre-commit` checks out the tree `git write-tree` builds for this commit (including for `git commit -a` and `git commit <paths>`) and runs the quality gate and a TypeScript typecheck there, so unstaged edits, untracked and intent-to-add files, and files recreated after `git rm` can neither help nor hurt, skip-worktree files are present, and modes, symlinks, and attributes come from the staged tree. `scripts/hooks/pre-push` runs the full test suite (about 65 seconds) once per distinct commit a pushed ref will point to, whatever the checkout contains and whichever branch is checked out; intermediate commits of a pushed range are not tested separately, so a passing push says nothing about whether every commit builds on its own (bisectability), and deleting a remote branch runs nothing. A pass is evidence about the tested commit in this machine's environment, not about every environment it may run in. The temporary worktree ignores the caller's sparse checkout and any local replacement objects. Every temporary worktree installs its own dependencies with `npm ci` (a few seconds from the npm cache), which refuses a `package.json` that disagrees with its `package-lock.json`; it never borrows the checkout's `node_modules`. The Rust build cache is shared. Both call `enter_repository` from `scripts/hooks/lib/enter-repository.sh`, which clears the repository-local variables Git exports into hooks so tools that ask Git about the repository get the right answer in linked worktrees. `spec/git-hook-entrypoints.spec.mjs` runs the real hooks with `npm` and `npx` stubbed.

Bug reports, design feedback, and causal UX ideas are welcome through GitHub issues and Discussions.

## Information

Latest news, design notes, and witness surfaces live in the repository. For deeper dives into provenance, worldlines, history, Echo hosting, and command explanation, start in `docs/design/` and `docs/jim-component-ownership.md`.

### Useful entry points

- `scripts/jedit-command-provenance-witness.mjs` — command provenance witness.
- `scripts/jedit-echo-host-witness.mjs` — generated operation, Echo tick, and
  bounded-reading witness.
- `scripts/jedit-production-cutover-guard.mjs` — rejects local production
  authority and fake compatibility paths.

If something goes wrong, read the relevant design docs, run the nearest witness, and then open an issue.

This is the early README for Jim: Jedit Is Modal.

---

From the mind of: `flyingrobots`.
