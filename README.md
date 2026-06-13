# jedit

![jedit title screen](https://github.com/user-attachments/assets/c15575ba-b680-4880-baed-2bfa55c84b10)

Terminal-first, Vim-shaped editor built on Bijou and shaped around causal
history through Echo.

`jedit` is the product pressure for the Echo stack — a real editor that forces
the lower layers to prove the seams that matter: contract-shaped edits, bounded
reads, provenance, replayable observations, and eventual undo-as-counter-history.
If Echo can't serve a working editor, it doesn't ship.

The active product direction is **JIM: Jedit Is Modal**. The repository,
packages, release gates, contracts, and WSC directories remain `jedit` until the
Echo-powered proof and compatibility plan make a user-facing `jim` command safe.

The product promise Jim must earn before a public editor release is:

```text
Jim is a modal editor for people and agents who need edits to be explainable,
recoverable, and reviewable.
```

---

## Quick start

```sh
npm install
npm run dev
```

Press `?` inside the editor for the key binding reference.

---

## What you get right now

- **Vim-shaped editing** — Normal/Insert modes, `w b e dd yy p u ctrl+r`, and growing
- **File drawer** — directory navigation, open files with Enter
- **Graft drawer** — current-file structural outline and change summary via the direct Graft API
- **Markdown preview** — live lens over the active buffer (`ctrl+p` to toggle)
- **Syntax highlighting** — themed source rendering for supported languages
- **Echo-hosted text session** — every edit submits a contract intent through
  `TextBufferOptic`; the production TUI has no non-Echo text runtime mode
- **Structural-history contract** — `replaceTextRange` operation identity comes from Wesley-generated metadata, not hardcoded strings
- **WSC history surfaces** — JSON witnesses can list, export, and replay current
  and historical editing evidence
- **Jim/Vim roadmap** — command-line completion exists; the active roadmap is
  first-class Vim grammar, basis-bound motions, text objects, registers, macros,
  repeat, and causal proof
- **Echo History drawer** — a first interactive history drawer lists
  editor-shaped Echo activity such as opens, edits, reads, exports, checkpoints,
  and obstructions
- **Witness scripts** — JSON-reporting evidence tools for CI and agents (see [Witnesses](#witnesses))

---

## Documentation

| Document | What it covers |
|----------|----------------|
| [GUIDE.md](GUIDE.md) | Running, building, validating, generating contracts |
| [ADVANCED_GUIDE.md](ADVANCED_GUIDE.md) | How a buffer becomes terminal pixels — the full render path |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layer rules, dependency graph, editor vocabulary, testing rules |
| [VISION.md](VISION.md) | Long-term product direction |
| [AGENTS.md](AGENTS.md) | Agent-specific guidance and witness commands |
| [docs/BEARING.md](docs/BEARING.md) | Compact current state, active roadmap anchors, and non-negotiables |
| [docs/stack-map.md](docs/stack-map.md) | Current jedit/Echo/Wesley/Graft/Bijou layer map |
| [docs/method/roadmap-planning.md](docs/method/roadmap-planning.md) | Roadmap, release-gate, slice, and proof policy |
| [docs/technical-teardown.md](docs/technical-teardown.md) | **Deep technical reference** — domain dictionary, golden paths, payload anatomy, trade-offs, security boundaries, async model |
| [docs/jedit-echo-end-to-end.md](docs/jedit-echo-end-to-end.md) | The full jedit + Echo process-level path |
| [docs/design/](docs/design/) | Design notes: project invariants, runtime temperatures, text-edit algebra, causal event model, structural history |

The teardown is the right starting point if you want to understand how the
codebase actually works — it covers the Bijou TEA loop, the hexagonal layer
rules, the three pure domain contracts, the dual-transport design, the
`ReadBasisHandle` capability pattern, and all major architectural trade-offs.
It is a deep reference, not the current roadmap. Use `docs/BEARING.md` and the
design docs above for the active goalpost trail.

---

## Product invariants

`jedit` is aiming for a quiet editing surface with smart edges, not a terminal
IDE clone.

The full invariant set is written down in
[docs/design/project-invariants.md](docs/design/project-invariants.md).
The identity doctrine is canonical in
[docs/design/echo-identity-doctrine.md](docs/design/echo-identity-doctrine.md).
The short operational guide is [GUIDE.md](GUIDE.md).
The end-to-end buffer rendering path is explained in
[ADVANCED_GUIDE.md](ADVANCED_GUIDE.md).
The process-level jedit + Echo path is explained in
[docs/jedit-echo-end-to-end.md](docs/jedit-echo-end-to-end.md).

- Zen core, instrumented edges. The main editor area stays visually quiet;
  richer context appears at the edges and only when it earns the space.
- Minimal by default. Panels are hidden until explicitly opened.
- One-line header. The header identifies what the main pane is showing and
  does not turn into a dashboard.
- Two-line footer. The top line belongs to the focused surface and may change
  rapidly. The bottom line carries slower workspace and buffer truth.
- Buffers are not panes. Panes are not panels. Lenses are not extra buffers.
- Panels are tools, not furniture. The same chord opens and closes the same panel.
- `tab` cycles only across visible interactive panes. Hidden panels do not
  participate in focus order.
- Strongly Vim-shaped without trying to become "vim 2". Familiarity matters;
  reenactment is not the goal.
- Alternate views of a file are lenses over the active buffer, not separate
  truths. Markdown preview is the first lens; others must justify themselves.
- Truth beats convenience. If a panel is showing saved-on-disk structure while
  the buffer is dirty, the UI should say so explicitly.
- Anything noisy must earn its existence.

The full invariant set is in [docs/design/project-invariants.md](docs/design/project-invariants.md).

---

## Stack posture

`jedit` is the release gate for Echo `v0.1.0`. Echo does not ship until jedit
can run a real contract-backed edit/read/replay path end-to-end.

The authority split is non-negotiable:

- **Application code** submits edit intents and observes readings through
  `TextBufferOptic`. It holds `ReadBasisHandle` capability tokens — opaque,
  unforgeable, and scoped to one session.
- **Trusted host code** owns package install, runtime lifecycle, scheduler
  policy, and fault recovery. Application code has no path to these.

**Echo** owns substrate truth: worldlines, rope heads, tick receipts, scheduler
materialization, and observed readings. `jedit` never manufactures raw substrate
coordinates.

**Wesley** is the contract compiler. GraphQL SDL in `contracts/jedit/` is the
canonical authority. TypeScript types, Zod schemas, and operation metadata are
generated output — not authored source.

**Graft** provides structural intelligence (syntax spans, outlines, diagnostics,
structural diff) over saved workspace files through the direct `@flyingrobots/graft`
API. It is an enrichment engine, not the editing kernel.

Full posture details live in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Development

### Environment

| Variable | Effect |
|----------|--------|
| `JEDIT_TEXT_RUNTIME` | Unset or `echoHosted` → Echo-hosted production text runtime. Any other value is unsupported startup input. |
| `JEDIT_PERF` | Set to `1` to enable the frame-time performance overlay. |
| `ECHO_WARP_WASM_DIR` | Path to Echo's `crates/warp-wasm` directory. Required for the opt-in real WASM witness only, not for the default TUI. |

### Validate

```sh
npm run check   # build + test + quality gate
```

The default app runtime is Echo-hosted and requires no sibling repo checkout.
Focused tests may still inject fake ports directly when they need fixture-only
behavior, but the production TUI does not expose a non-Echo runtime profile.

### Witnesses

```sh
# Fast smoke path — installed jedit contract transport, no Echo checkout needed
npm run witness:echo:session

# Opt-in real WASM witness — requires a built Echo checkout
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  node scripts/jedit-echo-witness.mjs --json --replay
```

The witness scripts report contract metadata, reading identity, artifact hash,
authority split, retained-evidence posture, and replay posture as JSON. They are
the canonical proof that the stack works end-to-end.

### Contract generation

```sh
# Structural-history only (no sibling checkout needed — uses published wesley-cli)
npm run gen:contract:structural-history:wesley

# Full contract surface (requires JEDIT_WESLEY_ROOT pointing at a Wesley checkout)
JEDIT_WESLEY_ROOT=/path/to/wesley npm run gen:contract
```

`npm run build` and `npm test` run the structural-history generator
automatically before TypeScript compilation.

---

## Next steps

The immediate roadmap is not release preparation. Release stays off the active
radar until Jim has reliable editor trust, polished UI/UX, and one unmistakable
causal product workflow.

The active product loop is:

```text
explain -> preview -> admit -> recover
```

The active product ladder is:

1. **Editor Trust Gate** — open, edit, save, quit, search, dirty-state, and
   disk-output guardrails are witness-proven.
2. **Command Provenance And `:why`** — the last meaningful Vim edit can explain
   what ran, what target resolved, what changed, and what evidence proves it.
3. **Historical Basis Preview** — History can preview a bounded historical
   reading while clearly saying the current head is unchanged.
4. **Search Sets And Substitute Strand Preview** — search creates basis-bound
   result sets, `:%s` previews a proposal strand, and `:admit` admits selected
   rows.
5. **Historical Yank And Register Provenance** — retained historical material
   can be yanked into the current head with source evidence.
6. **Vim Power Core** — visual mode, serious registers, semantic repeat, macros,
   marks, structural text objects, and range commands land through causal
   proofs.
7. **Agent-Safe Editing** — agents produce accountable proposal strands with
   basis, range, rationale, evidence, and admission paths.

Next implementation start:

- Start [WF-0108 Jim Command Provenance And :why](docs/design/0108-causal-command-provenance-surface.md)
  with an Editor Trust Gate preflight.
- Keep [WF-0105 Vim Power Moves Causal Parity](docs/design/0105-vim-power-moves-causal-parity.md)
  as the broad Vim substrate roadmap, but choose next Vim slices by whether
  they strengthen provenance, preview, replay, safe destructive edits, agent
  witnesses, structural objects, or user trust.
- Keep title-rendering work on the separate
  [WF-0107 Geordi title-render lane](docs/design/0107-geordi-raytraced-title-render-pipeline.md)
  until rendering is the explicit objective.
- Keep `README.md`, `docs/technical-teardown.md`, and signpost docs truthful in
  compact passes; do the full rewrite after command provenance, history, and
  broad-edit preview prove the final shape.
