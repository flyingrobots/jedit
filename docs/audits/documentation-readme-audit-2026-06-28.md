# Documentation & README Audit (Completeness Check) — `jedit` / "Jim"

**Date:** 2026-06-28
**Role:** Technical Writer & Senior Developer Advocate
**Scope:** `README.md` validated against the codebase, plus the supporting doc set (`GUIDE.md`, `ADVANCED_GUIDE.md`, `ARCHITECTURE.md`, `CODE_STANDARDS.md`, `AGENTS.md`, `VISION.md`, `CHANGELOG.md`, `docs/`).
**Verdict:** Recommendation **A — incremental updates.** The doc set is unusually rich and mostly accurate; the problems are *targeted*: one wrong function reference, a missing "how do I open a file" path, an inconsistent run incantation, and four absent standard files.

---

## 1. Accuracy & Effectiveness Assessment

### 1.1 Core Mismatch (the single most critical inaccuracy)

**`ADVANCED_GUIDE.md:41` documents a function that does not exist where or how it claims.**

> "Opening a file eventually calls `loadEditor(filePath)` in `src/main.ts`."

Verified against the code, this is wrong on three counts:

- **Wrong location.** `loadEditor` is defined in `src/app/workspace/editor-session.ts:46`, not `src/main.ts`. `src/main.ts` contains no reference to `loadEditor` at all.
- **Wrong signature.** The real signature is `loadEditor(filePath: string, editorFile: EditorFilePort)` — it requires an injected port; the docs show a one-arg call.
- **Wrong control flow.** `src/main.ts` routes `--version`/`--help` and otherwise calls `runJeditWorkspace()`, which **ignores `process.argv`** (`src/main-workspace.ts:26`). So the documented "open a file" entry path through `main.ts` does not exist.

This is the most critical inaccuracy because it is the *one place the docs try to explain the file-open lifecycle* — the editor's most fundamental operation — and it sends a new engineer to the wrong file with the wrong signature for a flow that isn't wired the way described.

### 1.2 Audience & Goal Alignment

**Primary audience (as written): contributors / proof-auditors**, not end users. The README is candid about this ("the quickstart is aimed less at 'install this polished public editor' and more at 'prove this Echo-backed edit/read path is real'"). That is a legitimate choice for the project's stage. Measured against that audience's top 3 questions:

| Question | Addressed? | Evidence |
|---|---|---|
| **"What is this and should I use it?"** | ✅ Strong | README "What is Jim?" + "Should I use Jim?" are clear, honest, and well-written. |
| **"How do I build, run, and validate it?"** | ⚠️ Partial | Build/validate steps exist (README "Compiling", GUIDE "Run/Validate"), but **how to actually open and edit a file is documented nowhere** (see 1.3). |
| **"How do I contribute (rules, process, security)?"** | ⚠️ Partial | `CODE_STANDARDS.md`, `AGENTS.md`, `ARCHITECTURE.md` cover doctrine, but there is **no `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, or `SECURITY.md`** (see 2.2). |

The end-user audience the README *gestures at* ("I have started dogfooding it … especially useful for editing programs") is **not** served: a dogfooding user has no documented way to open their file.

### 1.3 Time-to-Value (TTV) Barrier

**The single biggest bottleneck: after building, no document tells you how to open a file.** README "Compiling" ends at `node dist/main.js`; GUIDE "Run The App" ends at `npm run dev`. Both launch an empty workspace rooted at `cwd`, and because argv is ignored, `node dist/main.js myfile.txt` does nothing with the file. No doc mentions an in-editor `:e`/`:edit`, a file picker, or a CLI argument — grep across README/GUIDE/ADVANCED_GUIDE/`vi_diff.txt` finds zero "open a file" instructions. A new developer reaches a blank editor and is stranded at the exact moment they expected to start editing.

A secondary, smaller barrier: **two inconsistent start incantations.** README says `npm ci` → `npm run build` → `node dist/main.js`; GUIDE says `npm install` → `npm run dev`. Neither cross-references the other, so a reader can't tell which is canonical.

---

## 2. Required Updates & Completeness Check

### 2.1 README.md Priority Fixes (top 3 to reach accuracy)

1. **Add a "Opening and editing a file" section.** Document the real way to open a file today (in-editor command and/or the CLI arg once it exists), and the basic save command. This closes the 1.3 TTV gap and the 1.2 end-user question. *(If the CLI file-arg is not yet implemented, say so explicitly rather than implying `node dist/main.js <file>` works.)*
2. **Reconcile the run instructions with `GUIDE.md`.** Pick one canonical quickstart (`npm ci && npm run build && npm start`, or `npm install && npm run dev`) and make README + GUIDE agree, noting that `npm run dev` uses `tsx` for source iteration while `npm run build` + `start` runs compiled `dist/`.
3. **Fix/clarify the docs index.** The README "Documentation" list omits `VISION.md` and `CODE_STANDARDS.md` (both present at repo root) and points readers to `docs/releases/` for a "quickstart" that is actually a release-gate proof. Align the index with what each file really delivers.

### 2.2 Missing Standard Documentation

Confirmed absent at repo root (and, per repo scaffolding policy for `flyingrobots` repos, expected):

- **`SECURITY.md`** — *required by policy and high-value here.* The project executes external binaries resolved via `PATH` (graft/colorful) and reads/writes user files; there must be a documented vulnerability-reporting channel and a statement of the runtime trust model.
- **`CONTRIBUTING.md`** — doctrine lives in `CODE_STANDARDS.md`/`AGENTS.md`, but there is no single "how to propose a change, run the gate, and open a PR" entry point for a human contributor.
- **`NOTICE`** — required alongside the Apache-2.0 `LICENSE` for an Apache-licensed project (attribution notices). Present: `LICENSE`. Missing: `NOTICE`.
- **`CODE_OF_CONDUCT.md`** — standard for a public GitHub project; currently absent.

### 2.3 Supplementary Documentation (one undocumented complex area)

**The file-load/encoding/fingerprint boundary in `src/adapters/editor-file.ts` is under-documented and the one doc that describes it (`ADVANCED_GUIDE.md` "Loading A Buffer") is partly wrong (1.1).** This is a genuinely subtle area: null-byte binary detection, lossy `toString('utf8')` decode, `EditorFileFingerprint` generation, and the `EditorFileLoadResult` variants (`directory`/`missing`/`obstructed`/binary/text). None of the port methods carry JSDoc, and the durability/encoding guarantees are unstated. This area deserves a corrected, dedicated write-up because it is exactly where correctness/data-integrity bugs hide.

---

## 3. Final Action Plan

### 3.1 Recommendation Type — **A. Incremental updates.**

The documentation is extensive, well-written, and largely accurate; a full rewrite would destroy real value. The defects are specific and individually small: one wrong function reference, one missing file-open story, one inconsistent run command, and four missing standard files.

### 3.2 Deliverable — Generated prompt (Incremental: apply 2.1 fixes + create 2.2 files)

> **Prompt:** `Update the jedit documentation for accuracy and completeness without rewriting it wholesale.`
>
> `README.md: (1) Add an "Opening and editing a file" section describing how to actually open a file today and how to save; if no CLI file argument exists yet, state that explicitly instead of implying 'node dist/main.js <file>' opens a file. (2) Reconcile the quickstart with GUIDE.md so both agree on one canonical run path, noting npm run dev (tsx/source) vs npm run build + npm start (compiled dist). (3) Correct the "Documentation" index to include VISION.md and CODE_STANDARDS.md and to describe docs/releases/ accurately as the release-gate proof path, not a user quickstart.`
>
> ADVANCED_GUIDE.md: Fix the stale runtime-shape references, not only the "Loading A Buffer" section. EditorState lives in `src/app/workspace/editor/model.ts`, not `src/main.ts`. loadEditor lives in `src/app/workspace/editor-session.ts` (signature loadEditor(filePath: string, editorFile: EditorFilePort)), not `src/main.ts`. commitMutation lives in `src/app/workspace/editor-editing-core.ts`, not `src/main.ts`. The app/runtime loop lives in `src/app/workspace/runtime.ts` with composition through `src/main-workspace.ts`, and `src/main.ts` only remains the process entrypoint for startup CLI routing. Bijou-facing rendering helpers live under `src/ui/workspace-render.ts` plus workspace viewer modules, not as a monolithic `src/main.ts` app. Describe the real load path through loadEditorFile in `src/adapters/editor-file.ts`, including null-byte binary detection, UTF-8 decoding, and fingerprinting.
>
> `Create the missing standard files at repo root, consistent with the Apache-2.0 license and the project's flyingrobots scaffolding policy: SECURITY.md (vulnerability-reporting channel + a short runtime trust model covering PATH-resolved external binaries and local file I/O), CONTRIBUTING.md (how to set up, run npm run check, follow the non-negotiables in CODE_STANDARDS.md/ARCHITECTURE.md, and open a PR), NOTICE (Apache-2.0 attribution), and CODE_OF_CONDUCT.md (a standard template). Cross-link the new files from README.`
>
> `Add JSDoc to EditorFilePort methods in src/ports/editor-file.ts documenting encoding, durability, and failure semantics, and add a focused docs/topics/file-loading.md explaining the editor-file.ts load/encoding/fingerprint boundary. Do not change any code behavior in this task; documentation and comments only. Verify every file path and function reference you write against the actual source before committing.`

### 3.3 Mitigation Prompt (ready to execute)

> Act as a technical writer hardening the jedit docs for accuracy. Step 1: verify each claim by reading the referenced source (`src/main.ts`, `src/main-workspace.ts`, `src/app/workspace/editor/model.ts`, `src/app/workspace/editor-session.ts`, `src/app/workspace/editor-editing-core.ts`, `src/app/workspace/runtime.ts`, `src/ui/workspace-render.ts`, `src/adapters/editor-file.ts`, `package.json` scripts). Step 2: apply the README and ADVANCED_GUIDE corrections in 3.2, fixing all stale Advanced Guide runtime references, the loadEditor location/signature error, and the file-open + canonical-run sections. Step 3: create SECURITY.md, CONTRIBUTING.md, NOTICE, and CODE_OF_CONDUCT.md at repo root and link them from README. Step 4: add JSDoc to EditorFilePort and a docs/topics/file-loading.md. Constraints: documentation only, no behavior changes; every file path / function name you write must be confirmed against the current source; keep the project's honest, plain-spoken tone. Finish by listing every claim you verified and the file:line you verified it against.

---

### Evidence Basis

- Wrong runtime references: `ADVANCED_GUIDE.md` still points core editor state, `loadEditor`, mutation, and Bijou app ownership at `src/main.ts`; actual anchors include `src/app/workspace/editor/model.ts` (`EditorState`), `src/app/workspace/editor-session.ts:46` (`loadEditor(filePath: string, editorFile: EditorFilePort)`), `src/app/workspace/editor-editing-core.ts:380` (`commitMutation`), `src/app/workspace/runtime.ts` (`createWorkspaceRuntime`), `src/ui/workspace-render.ts` (rendering helpers), `src/main-workspace.ts` (workspace boot), and `src/main.ts` only remains the process entrypoint / startup CLI switch.
- No file-open instructions: grep for `:e`/`:edit`/`open a file` across README/GUIDE/ADVANCED_GUIDE/`docs/vi_diff.txt` returns none.
- Run-command inconsistency: `README.md:53-54` (`npm ci` / `npm run build`) vs `GUIDE.md:13,19` (`npm install` / `npm run dev`).
- Missing standard files (confirmed absent at root): `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `NOTICE`. Present: `LICENSE`, `CHANGELOG.md`, `ARCHITECTURE.md`, `CODE_STANDARDS.md`, `AGENTS.md`, `VISION.md`.
- Doc index gaps: README "Documentation" list omits root-level `VISION.md` and `CODE_STANDARDS.md`.
