# Two-Phase Assessment — `jedit` / "Jim"

**Date:** 2026-06-28
**Reviewer perspectives:** Senior Developer Advocate (DX), Senior Architect & Auditor (IQ), Strategic Lead (synthesis)
**Codebase type:** Terminal-first modal editor + Echo-backed causal-editing proof harness (TypeScript, hexagonal). 330 source files, ~51k LOC, 166 spec files, strict `tsc`, no ESLint. Remote: `flyingrobots/jedit`.

---

## 0. Executive Report Card (Strategic Lead)

| Metric | Score | Recommendation |
|---|---|---|
| **Developer Experience (DX)** | **4 / 10** | **Best of:** Structured, recoverable error model — every obstruction carries `code` + `message` + `recovery` (`src/adapters/jedit-mutation-obstruction-mappers.ts`). |
| **Internal Quality (IQ)** | **9 / 10** | **Watch Out For:** No ESLint despite a mandate for maximal lint strictness — the entire "non-negotiable" doctrine (≤500 LOC, no `any`, no magic strings) is enforced by convention + review, not tooling. One inattentive merge erodes it. |
| **Overall** | **THUMBS UP** | **Justification:** As an internal proof harness and design lab it is among the most disciplined codebases audited; as a *consumable* editor it is honestly pre-alpha, which the README itself admits. |

> The DX score is low **by design** — the project is not yet pitched as installable. It is scored as a tool a developer must adopt, because that is what the template measures.

---

## 1. DX: Ergonomics & Interface Clarity (Advocate)

### 1.1 Time-to-Value — 3 / 10
TTV path is `npm ci → npm run build → node dist/main.js` (README "Compiling"). The single biggest boilerplate killer is not build steps — it is that **there is no installed binary and no file argument**. `src/main.ts` slices `process.argv`, but `jeditStartupCliAction` returns non-null for *exactly one* arg (`--version`/`--help`) and `runJeditWorkspace()` (`src/main-workspace.ts:26`) **ignores argv entirely** — it boots a workspace rooted at `cwd`. So `node dist/main.js README.md` silently does nothing with the file.

- **Action Prompt (TTV):** `In src/main.ts and src/main-workspace.ts, add a CLI port that parses positional file arguments. Introduce a JeditStartupInvocation type carrying { files: readonly string[]; flags } decoded at the adapter boundary (jedit-startup-cli.ts), and thread an initialOpenPaths option through createWorkspaceApp so 'node dist/main.js path/to/file' opens that file in a buffer on boot. Add a package.json "bin" entry mapping 'jedit' to dist/main.js. Cover argv parsing with a spec under spec/.`

### 1.2 Principle of Least Astonishment
Directly follows 1.1 and is the **single biggest POLA violation**: a self-described "Vim-shaped editor" does not honor `vim file.txt`. Every Vim user's first reflex (`jedit foo.ts`) is a no-op. They intuitively expect the named file to open; instead they get an empty workspace and must discover `:e` from inside.

- **Action Prompt (Interface):** `Make the jedit binary accept one or more file paths as positional arguments matching Vim's invocation contract (jedit [options] [file...]). Opening multiple files should create one buffer per file with the first focused. Update GUIDE.md and the --help text (STARTUP_CLI_USAGE in jedit-startup-cli.ts) to document 'jedit <file>' as the primary entry point.`

### 1.3 Error Usability
Internally this is a **strength**, not a weakness: `envelopeDecodeObstructedResponse` returns `{ code, message, recovery }` where `recovery` is a literal next action ("resubmit the intent using a valid EINT mutation envelope"). The gap is the *missing link layer* — recovery strings reference internal protocol nouns ("EINT mutation envelope", "register the worldline session via the optic client") with no pointer to where a human/agent learns those terms.

- **Action Prompt (Error Handling):** `In src/adapters/jedit-mutation-obstruction-mappers.ts, extend the obstruction shape with an optional 'docs' field (a stable doc anchor, e.g. docs://obstructions/JEDIT_MUTATION_ENVELOPE_INVALID). Generate a docs/topics/obstructions.md catalog keyed by obstruction code from a single source of truth, and add a spec asserting every exported *_CODE constant has a catalog entry, so recovery strings always resolve to documentation.`

---

## 2. DX: Documentation & Extendability (Advocate)

### 2.1 Documentation Gap
Documentation *volume* is high (GUIDE, ADVANCED_GUIDE, ARCHITECTURE, BEARING, design/, method/). The missing piece is a **"First 5 minutes as a user" quickstart** — every doc is written for a contributor/proof-auditor. `docs/releases/` is described as "prove this Echo-backed path is real," not "edit your first file." There is no `:command` reference for the editor surface a daily-driver would reach for.

- **Action Prompt (Docs):** `Create docs/quickstart.md aimed at a Vim user who wants to edit one real file: install/build, open a file, the supported Normal/Insert subset, how to save, and how to invoke :why and the history drawer. Cross-link it from README "Should I use Jim?". Generate a command-surface reference (docs/topics/commands.md) from the runtime command registry rather than hand-authoring it.`

### 2.2 Customization — 6 / 10
Strongest extension point: the **ports/adapters seam** — capabilities (Graft highlighting, Echo transport, filesystem, MCP) are injected into app services, so swapping an implementation needs no core edits (`ARCHITECTURE.md` Dependency Rule). Weakest/most fragile: **keybindings & command surface** are wired in code (`src/app/workspace/vim-command-executor.ts`, `vim-chord-syntax.ts`, `command-completion.ts`) with no external config/registration path — extending the command set means editing core source, the exact thing customization should avoid.

- **Action Prompt (Extension):** `Introduce a command-registration port that lets adapters contribute commands/chords without editing vim-command-executor.ts. Define a JeditCommandDescriptor (id, chord, handler, provenance source) and a registry the executor consults, then migrate existing commands onto it. This turns the command surface into a composition point and prepares for user-supplied keymaps.`

---

## 3. Internal Quality: Architecture & Maintainability (Architect)

### 3.1 Technical Debt Hotspot
No single file is *bad* — but the **cluster of ten files at 490–499 LOC** is the debt signal. With a hard "no file over 500 LOC" non-negotiable, `src/app/workspace/viewer-content.ts` (499), `src/adapters/jedit-echo-optic-codec.ts` (499), `src/ui/workspace-chrome.ts` (498), `src/app/jedit-contract-runtime.ts` (496) are pressed against the ceiling. The cap is being satisfied *numerically*, which risks artificial splits and growing internal coupling that the metric cannot see. `src/app/workspace` alone holds 102 files — the highest concentration of orchestration.

- **Action Prompt (Debt):** `Audit the ten src files between 490–499 LOC. For each, decide whether it is one cohesive responsibility (raise the doctrine cap with justification in ARCHITECTURE.md) or two responsibilities hugging the limit (extract along the seam into a named collaborator). Do not change public interfaces; add no new magic strings. Record the decision per file in docs/code-standards-audit.md.`

### 3.2 Abstraction Violation
The codebase is notably clean on SoC — boundary decode is genuinely pushed to adapters. The closest real violation is `src/main.ts` performing **I/O (`writeSync` to fd 1)** *and* invocation routing inline. It is small, but it is app/transport concern leaking into the entry shim and is exactly where the swallowed-argv bug lives.

- **Action Prompt (SoC):** `Extract main.ts's stdout writing and startup routing into a StartupPresenter (ui/) plus a StartupRouter (app/) behind an OutputPort, leaving main.ts as a thin composition root that wires ports to adapters and delegates. Add a spec that drives the router with fake argv + a fake OutputPort, asserting --version/--help and file-open routing without touching real stdout.`

### 3.3 Testability Barrier
The primary barrier is the **test execution model**: `test:all` runs `npm run build && JEDIT_DIST_PREBUILT=1 node --test ... spec/**/*.spec.mjs` — specs are `.mjs` exercising **compiled `dist/` output**, single-concurrency. There is no fast TS-level unit path; every test run pays a full `tsc` build, and tests bind to emitted JS rather than source. That discourages tight red-green loops despite the otherwise injectable architecture.

- **Action Prompt (Testability):** `Add a fast unit lane that runs specs against TypeScript via tsx/node --import without a full dist build (e.g. npm run test:unit), reserving the dist-prebuilt lane for integration/witness specs. Keep test:all as the gate. Verify a representative domain spec passes in both lanes to prove source/dist parity.`

---

## 4. Internal Quality: Risk & Efficiency (Auditor)

### 4.1 The Critical Flaw
**Doctrine enforced by humans, not machines.** The "Non-Negotiables" (≤500 LOC, no `any`, no `unknown`, no magic strings, no stringly state machines) are real and currently *honored* — the audit found **1 `any` (in a comment), 0 `@ts-ignore`, 1 TODO** across 51k LOC, which is exceptional. But there is **no ESLint config**, so nothing mechanically blocks regression. `tsconfig` is excellent (strict + `noUncheckedIndexedAccess` + `noPropertyAccessFromIndexSignature`), yet it cannot enforce LOC caps, magic-string bans, or import-direction rules. The doctrine is one inattentive merge from erosion.

> Per repo policy this is flagged, not fixed — it conflicts with the global "maximize linter strictness" mandate; awaiting confirmation before any change.

- **Action Prompt (Risk Mitigation):** `Add an ESLint flat config with the strictest TypeScript ruleset (typescript-eslint strict-type-checked + stylistic), promote all warnings to errors, ban any/unknown via no-explicit-any and a custom rule, and add eslint-plugin-boundaries to encode the hexagonal dependency rule (ui→app→domain/ports, adapters→ports). Add a max-lines rule at 500. Wire 'npm run lint' into the CI static/build job and a pre-commit hook in scripts/hooks/.`

### 4.2 Efficiency Sink
The structural risk is the **build-coupled feedback loop** (see 3.3) rather than a hot-path algorithm: every `dev`, `build`, and `test` re-runs Wesley contract generation (`gen:contract:structural-history:wesley`) before `tsc`. For a 330-file project this serializes generation → full compile → asset copy on every iteration, single-concurrency tests on top.

- **Action Prompt (Optimization):** `Make Wesley contract generation incremental/cached: skip regeneration when contracts/jedit/*.graphql and the generator are unchanged (hash-gate the .wesley-cache outputs). Enable tsc incremental builds (composite/tsBuildInfoFile). Measure cold vs warm 'npm run build' and record the delta.`

### 4.3 Dependency Health
Dependencies are few and first-party-heavy: core `@flyingrobots/bijou` packages are exact-pinned to `7.0.0`, `@flyingrobots/graft` is exact-pinned to `0.10.1`, and `@flyingrobots/bijou-i18n` and its tools use `^7.0.0`. The watch item is still **Graft at 0.10.1 (pre-1.0) with a visibly churning surface** — the CHANGELOG shows multiple Graft bumps (0.10.0→0.10.1, "colorful 0.2.1 numeric IR identifiers") in the unreleased window alone. A pre-1.0 dependency on the syntax/highlight critical path is the highest-volatility external risk even though it is already exact-pinned. No GPL/AGPL contamination observed; no CVE-bearing package surfaced.

- **Action Prompt (Dependency):** `Keep @flyingrobots/graft exact-pinned at 0.10.1, add a CHANGELOG/compat note documenting the minimum colorful IR version it requires, and add a smoke spec that asserts the Graft highlight adapter degrades gracefully (no crash, plain projection) when the expected parser runtime or colorful version is absent on PATH. Separately decide whether the ranged @flyingrobots/bijou-i18n and bijou-i18n tool packages should stay ranged for lockstep patch intake or be exact-pinned with the rest of the Bijou runtime surface.`

---

## 5. Strategic Synthesis & Action Plan (Strategist)

### 5.1 Combined Health Score — 7 / 10
World-class internals dragged down by deliberate pre-alpha consumability. The engineering *discipline* is a 9; the *adoptability* is a 4. Weighted to a 7: this is a healthy, honest codebase that has chosen depth before reach.

### 5.2 Strategic Fix (highest leverage, improves DX **and** IQ)
**Implement real CLI invocation: `jedit [file...]`.** It is the highest-leverage single move because it simultaneously:

- **DX:** fixes the #1 TTV blocker (1.1) *and* the #1 POLA violation (1.2) — `jedit file.txt` finally does the obvious thing.
- **IQ:** forces resolution of the swallowed-argv SoC leak in `main.ts` (3.2) by introducing a proper startup-invocation port/adapter, replacing inline `writeSync` routing with a testable seam (3.3).

One change closes the worst usability gap and the worst structural shortcut at the editor's front door.

### 5.3 Mitigation Prompt (Strategic Priority)

- **Action Prompt:** `Implement first-class file-open invocation for jedit, addressing both usability and structure. (1) Decode argv at the adapter boundary in jedit-startup-cli.ts into a JeditStartupInvocation { files: readonly string[]; printAction?: ... }, supporting 'jedit [--version|--help] [file...]'. (2) Replace the inline writeSync routing in src/main.ts with a thin composition root that wires an OutputPort adapter and a StartupRouter, eliminating the I/O+routing mixing flagged in SoC review. (3) Thread initialOpenPaths through runJeditWorkspace → createWorkspaceApp so named files open as buffers (first focused) on boot. (4) Add a package.json "bin": { "jedit": "dist/main.js" } entry. (5) Add specs covering argv parsing (version/help/files/none) against a fake OutputPort, and an integration spec asserting a named file is opened. (6) Update README "Compiling", GUIDE.md, and --help text to document 'jedit <file>' as the primary entry point. Honor the non-negotiables: no any/unknown, no new magic strings, keep every touched file under 500 LOC.`

---

## Reviewer Notes

- **Strongest signal:** 51k LOC with effectively zero type escapes and a coherent hexagonal boundary is rare. The doctrine works — it just is not *armored* (4.1).
- **Flagged, not fixed (per flyingrobots policy):** the missing-ESLint finding (a conflict with the "maximize linter strictness" mandate) and the Graft pre-1.0 dependency risk both await confirmation before any change.

### Evidence basis

- Type discipline: 1 `: any`/`as any` (a comment), 12 `unknown`, 0 `@ts-ignore`/`@ts-expect-error`, 1 TODO across 330 `.ts` files / ~51k LOC.
- LOC cap: largest source file is 499 LOC; ten files sit in 490–499.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noUnusedLocals/Parameters`.
- Entry path: `src/main.ts` → `jeditStartupCliAction` (1-arg version/help only) → `runJeditWorkspace()` ignores argv.
- Error model: `src/adapters/jedit-mutation-obstruction-mappers.ts` (`code`/`message`/`recovery`).
- CI: single `.github/workflows/ci.yml` with sharded test planning; no lint job.
