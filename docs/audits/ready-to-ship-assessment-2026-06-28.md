# Ready-to-Ship Assessment (Exhaustive Mode) — `jedit` / "Jim"

**Date:** 2026-06-28
**Role:** Senior Principal Software Auditor (long-term maintenance risk + deployment feasibility)
**Scope:** Full repository at `flyingrobots/jedit`, `main`. Terminal-first modal editor + Echo-backed causal-editing harness. 330 `.ts` files, ~51k LOC, 166 specs, strict `tsc`, no ESLint.
**Headline:** Internals are exceptionally clean; the **primary file-save path is not crash-safe and not conflict-safe**, which is disqualifying for a tool whose entire thesis is *trust, auditability, and recoverability*.

---

## 1. Quality & Maintainability Assessment (Exhaustive)

### 1.1 Technical Debt Score — **3 / 10** (1 = Excellent, 10 = Unmaintainable)

Low debt, and that is an evidence-backed claim: **1 `any` (in a comment), 12 `unknown`, 0 `@ts-ignore`, 1 TODO, 0 stray `console.*`** across 51k LOC, under a strict `tsconfig` (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`). The three patterns that keep it from a 1–2:

1. **Doctrine enforced by humans, not tooling.** Every "non-negotiable" (≤500 LOC, no `any`, no magic strings, inward dependencies) lives in `ARCHITECTURE.md` and reviewer vigilance. There is **no ESLint config and no lint job in CI** (`.github/workflows/ci.yml` runs build + sharded tests only). The clean numbers are a *current* fact, not a *guaranteed* one.
2. **LOC-cap fragmentation.** Ten files sit at 490–499 LOC against the hard 500 cap (`viewer-content.ts` 499, `jedit-echo-optic-codec.ts` 499, `workspace-chrome.ts` 498, `jedit-contract-runtime.ts` 496). The metric is met *numerically*; the risk is artificial splits and inter-file coupling the line count cannot see. `src/app/workspace` alone holds 102 files.
3. **Build-coupled feedback loop.** `test:all` = `npm run build && JEDIT_DIST_PREBUILT=1 node --test … spec/**/*.spec.mjs`, single-concurrency, against compiled `dist/`. Every test run pays a full Wesley-gen + `tsc`. Slow loops are a long-term maintenance tax.

### 1.2 Readability & Consistency

**Issue 1 — Public port methods carry no contract docs.** `src/ports/editor-file.ts` declares `saveEditorFile(filePath, lines): void` with no JSDoc stating durability guarantees, encoding, or failure mode (it throws, but nothing says so). A new engineer cannot tell from the type whether the save is atomic or whether errors are returned or thrown.

> **Mitigation Prompt 1:** `Add JSDoc to every method on the EditorFilePort interface in src/ports/editor-file.ts. For saveEditorFile, document: the file is written UTF-8; whether the write is atomic; that it throws on I/O failure (and which error shapes); and any preconditions (e.g. readOnly buffers must not call it). Match the documentation density of the obstruction mappers. Do not change signatures.`

**Issue 2 — Two parallel save entry points with different safety levels.** `saveEditor` (`src/app/workspace/editor-session.ts:105`) and the export path `exportWorkspaceText` (`src/app/workspace/workspace-text-commands.ts:345`) both end at `saveEditorFile`, but only the export path runs `materializationPreflightIssue(request)` to detect on-disk drift. Nothing in the code or naming signals that one path is conflict-checked and the other is not — a trap for onboarding engineers.

> **Mitigation Prompt 2:** `Unify the two save paths in src/app/workspace. Extract a single saveBuffer use-case that always runs the materialization preflight (drift/fingerprint check) before delegating to EditorFilePort.saveEditorFile, and route both saveEditor (editor-session.ts) and exportWorkspaceText (workspace-text-commands.ts) through it. Add a spec asserting a stale-fingerprint save is obstructed on both paths.`

**Issue 3 — Duck-typed Node error decoding inlined per adapter.** `nodeErrorCode` in `src/adapters/editor-file.ts:58` reaches into `'code' in cause && typeof cause.code === 'string'`. This idiom is re-derived across adapters instead of being a shared, named boundary decoder, so error-handling consistency depends on each author repeating it correctly.

> **Mitigation Prompt 3:** `Create a single shared helper (e.g. src/adapters/node-error.ts) exporting nodeErrorCode(cause: unknown): string | undefined with a named NodeErrnoException type guard. Replace the inline duck-typing in editor-file.ts and any sibling adapters with it. Add a unit spec covering an ENOENT error, a non-Error throw, and an error with no code.`

### 1.3 Code Quality Violations (SRP / unnecessary complexity)

**Violation 1 — `loadEditorFile` does five jobs in one function** (`src/adapters/editor-file.ts:17-47`): path classification (dir / non-file), I/O, binary detection, UTF-8 decode, fingerprinting, *and* error-to-result mapping.

Original (abridged):
```ts
export function loadEditorFile(filePath: string): EditorFileLoadResult {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) return directoryEditorFile(filePath);
    if (!stat.isFile()) return obstructedEditorFile(filePath, NON_FILE_MESSAGE);
    const bytes = readFileSync(filePath);
    const fingerprint = editorFileFingerprintFromBytes(bytes);
    if (bytes.includes(NULL_BYTE)) {
      return { lines: [BINARY_FILE_MESSAGE], readOnly: true, fingerprint };
    }
    return { lines: normalizeLines(bytes.toString(UTF8_ENCODING)), readOnly: false, fingerprint };
  } catch (cause) { /* maps ENOENT vs other */ }
}
```

Simplified Rewrite — separate *classification*, *decoding*, and *error mapping*:
```ts
export function loadEditorFile(filePath: string): EditorFileLoadResult {
  try {
    return classifyAndDecode(filePath);
  } catch (cause) {
    return loadErrorResult(filePath, cause);
  }
}

function classifyAndDecode(filePath: string): EditorFileLoadResult {
  const stat = statSync(filePath);
  if (stat.isDirectory()) return directoryEditorFile(filePath);
  if (!stat.isFile()) return obstructedEditorFile(filePath, NON_FILE_MESSAGE);
  return decodeRegularFile(readFileSync(filePath));
}

function decodeRegularFile(bytes: Buffer): EditorFileLoadResult {
  const fingerprint = editorFileFingerprintFromBytes(bytes);
  return bytes.includes(NULL_BYTE)
    ? { lines: [BINARY_FILE_MESSAGE], readOnly: true, fingerprint }
    : { lines: normalizeLines(bytes.toString(UTF8_ENCODING)), readOnly: false, fingerprint };
}

function loadErrorResult(filePath: string, cause: unknown): EditorFileLoadResult {
  const code = cause instanceof Error ? nodeErrorCode(cause) : undefined;
  return code === NODE_ERROR_NOT_FOUND
    ? missingEditorFile(filePath)
    : obstructedEditorFile(filePath, cause instanceof Error ? cause.message : String(cause), code);
}
```

> **Mitigation Prompt 4:** `Refactor loadEditorFile in src/adapters/editor-file.ts by extracting classifyAndDecode, decodeRegularFile, and loadErrorResult as shown, so each function has one responsibility. Keep behavior and the public signature identical; the existing editor-file specs must still pass unchanged. Keep the file under 500 LOC and introduce no magic strings.`

**Violation 2 — Imperative, mutation-based option assembly in the Graft process runner** (`src/adapters/graft-source-highlighter.ts:138-167`): a mutable `options` object is conditionally patched three times before `spawnSync`.

Original:
```ts
const options: SpawnSyncOptionsWithStringEncoding = { cwd: request.cwd, encoding: PROCESS_RUNNER_ENCODING, shell: false };
if (request.stdin != null) options.input = request.stdin;
if (request.timeoutMs != null) options.timeout = request.timeoutMs;
if (request.maxBufferBytes != null) options.maxBuffer = request.maxBufferBytes;
const result = spawnSync(request.command, request.args, options);
```

Simplified Rewrite — pure construction via conditional spread:
```ts
const options: SpawnSyncOptionsWithStringEncoding = {
  cwd: request.cwd,
  encoding: PROCESS_RUNNER_ENCODING,
  shell: false,
  ...(request.stdin != null && { input: request.stdin }),
  ...(request.timeoutMs != null && { timeout: request.timeoutMs }),
  ...(request.maxBufferBytes != null && { maxBuffer: request.maxBufferBytes }),
};
const result = spawnSync(request.command, request.args, options);
```

> **Mitigation Prompt 5:** `In createGraftSourceHighlighterProcessRunner (src/adapters/graft-source-highlighter.ts), replace the mutable options object and its three conditional assignments with a single immutable declaration using conditional spreads, so options is built once and never mutated. Confirm the highlighter specs still pass.`

**Violation 3 — `saveEditor` couples policy (readOnly guard + dirty-flag state) with the durability decision it cannot see** (`src/app/workspace/editor-session.ts:105-116`). It returns a clean (`dirty: false`) state *before knowing the bytes are durably on disk*, because `saveEditorFile` is fire-and-return with a non-atomic write underneath.

Original:
```ts
export function saveEditor(editor: EditorState, editorFile: EditorFilePort): EditorState {
  if (editor.readOnly) return editor;
  editorFile.saveEditorFile(editor.path, editor.lines);
  return { ...editor, dirty: false };
}
```

Simplified Rewrite — make durability a returned outcome, not an assumption:
```ts
export function saveEditor(editor: EditorState, editorFile: EditorFilePort): SaveEditorOutcome {
  if (editor.readOnly) return { kind: SaveOutcomeKinds.Skipped, editor };
  const result = editorFile.saveEditorFile(editor.path, editor.lines); // now returns SaveResult
  return result.kind === SaveResultKinds.Persisted
    ? { kind: SaveOutcomeKinds.Persisted, editor: { ...editor, dirty: false } }
    : { kind: SaveOutcomeKinds.Obstructed, editor, issue: result.issue };
}
```

> **Mitigation Prompt 6:** `Change EditorFilePort.saveEditorFile to return a discriminated SaveResult (Persisted | Obstructed{issue}) instead of void, and update saveEditor in editor-session.ts to only clear the dirty flag on Persisted, surfacing Obstructed to the caller. Keep the buffer dirty when a save fails. Add specs for the readOnly-skip, persisted, and obstructed branches.`

---

## 2. Production Readiness & Risk Assessment (Exhaustive)

### 2.1 Top 3 Ship-Stopping Risks ("Hard No")

**Risk 1 — Non-atomic file save can corrupt user data. [CRITICAL]** `src/adapters/editor-file.ts:50-52`
```ts
export function saveEditorFile(filePath: string, lines: readonly string[]): void {
  writeFileSync(filePath, joinLines(lines), UTF8_ENCODING);
}
```
This writes directly over the target path. A crash, `SIGKILL`, full disk, or power loss *mid-write* leaves the user's file truncated or partially written — total data loss. This is doubly indefensible because the repo **already has** the safe pattern elsewhere: `src/adapters/jedit-wsc-workspace-store.ts` writes a temp file and uses `rmSync(tempPath, { force: true })` cleanup around an atomic swap. The editor's headline promise is recoverability; its save path is the least recoverable code in the tree.

> **Mitigation Prompt 7:** `Make saveEditorFile in src/adapters/editor-file.ts crash-safe: write to a sibling temp file in the same directory (so rename is atomic on the same filesystem), fsync the file descriptor, then rename() over the target; clean up the temp file on failure. Preserve the original file's mode/permissions. Mirror the temp-write discipline already used in jedit-wsc-workspace-store.ts. Add a spec that asserts the original file is intact when the write step throws.`

**Risk 2 — Blind overwrite with no on-disk conflict detection (lost update / TOCTOU). [HIGH]** `src/app/workspace/editor-session.ts:105` → `saveEditorFile`. The load path computes a `fingerprint` (`editor-file.ts:28`), and the *export* path checks `materializationPreflightIssue`, but the plain `saveEditor` path overwrites `editor.path` regardless of whether the file changed on disk since it was opened. Two Jim instances, or Jim plus any external tool, silently clobber each other.

> **Mitigation Prompt 8:** `Thread the load-time fingerprint through saveEditor. Before writing, re-stat/re-fingerprint the on-disk file and compare to the fingerprint captured at open; if they differ, obstruct the save with a recovery message ("file changed on disk; reload or force-overwrite") instead of writing. Add an explicit force path for the user. Cover changed-on-disk and unchanged cases with specs.`

**Risk 3 — No top-level crash guard leaves the terminal wrecked. [HIGH]** No `process.on('uncaughtException'…)` or `'unhandledRejection'` handler exists anywhere in `src/` (grep returns only a comment). The app enters raw mode + mouse reporting via `run(app, { mouse: … })` (`src/main-workspace.ts:45`). Any uncaught throw (162 `throw` sites, 57 `catch`) on the render/input path crashes the process with the terminal still in raw/alt-screen/mouse mode — the user's shell is left unusable and any unsaved buffer is gone with no diagnostic.

> **Mitigation Prompt 9:** `Add a top-level safety net in src/main.ts (or a dedicated bootstrap adapter) that registers uncaughtException and unhandledRejection handlers which: restore the terminal (exit raw mode, disable mouse reporting, leave alt-screen) via the Bijou TUI teardown, flush a structured crash diagnostic, attempt an emergency swap-file save of dirty buffers, and exit non-zero. Verify the terminal is restored by simulating a thrown error in an integration spec.`

### 2.2 Security Posture

> Note up front: **command injection is NOT present.** Every external process call uses `shell: false` with array args (`graft-source-highlighter.ts:145`, `graft-diagnostics-adapter.ts:178`, `execFileSync('git', ['rev-parse'…])`). That is the correct posture. The two findings below are subtler and genuinely overlooked.

**Vulnerability 1 — PATH-based resolution of external binaries (supply-chain / PATH hijack). [MEDIUM]** The Graft/colorful runtimes are invoked by *name* (`request.command`) resolved through the inherited `PATH` (`graft-source-highlighter.ts:157`, `node-echo-recovery-command.ts:26`, `graft-diagnostics-adapter.ts:160`). If Jim is launched from a directory or environment where an attacker controls an earlier `PATH` entry (or a `./`-on-PATH shell), a malicious `graft`/`colorful` executable runs with the user's privileges on every file open. There is no pinned absolute path, checksum, or signature check.

> **Mitigation Prompt 10:** `Harden external runtime resolution. Resolve graft/colorful to an absolute path once at startup (configurable via an explicit env var or settings key), reject relative or cwd-local resolutions, and record the resolved path + version in the startup diagnostic. Document the trust assumption in docs/. Optionally verify a known version string before first use and degrade to plain projection if it cannot be verified.`

**Vulnerability 2 — Lossy/undetected non-UTF-8 content becomes silent data corruption on save. [MEDIUM]** `loadEditorFile` flags only files containing a NULL byte as binary (`editor-file.ts:30`); everything else goes through `bytes.toString('utf8')` (`editor-file.ts:38`), which **replaces** invalid byte sequences with U+FFFD. A latin-1/shift-JIS file with no null bytes loads as mangled text, is editable, and on `:w` is written back UTF-8 — silently corrupting the user's file. For an auditability-first editor this is an integrity failure, not a cosmetic one.

> **Mitigation Prompt 11:** `In loadEditorFile, detect invalid UTF-8 (not just null bytes) — e.g. decode with fatal/strict semantics or scan for U+FFFD after decode — and mark such buffers readOnly with an explicit "non-UTF-8 / unsupported encoding" obstruction instead of loading lossy text. Never write a buffer back in a different encoding than it was read. Add specs for a valid UTF-8 file, a null-byte binary, and an invalid-UTF-8 file.`

### 2.3 Operational Gaps (production)

> Framing: Jim is an interactive TUI, not a long-running service, so classic health-check/uptime probes are partly N/A. The gaps below are the operationally meaningful ones for *this* artifact.

- **Gap 1 — No crash telemetry / structured error reporting sink.** With 0 `console.*` and no `uncaughtException` handler, a field crash produces nothing actionable: no log file, no diagnostic bundle, no buffer-recovery trail. The witness/JSON tooling exists for CI but is not wired to runtime failures.
- **Gap 2 — No autosave / swap-file / crash recovery for in-memory buffers.** Dirty buffers live only in process memory (`EditorState.lines`); a crash or kill loses unsaved work entirely. Vim's `.swp` recovery is exactly the table-stakes feature a "recoverability" editor must ship.
- **Gap 3 — No release-artifact provenance / supply-chain attestation in CI.** `ci.yml` builds and shards tests but produces no signed build, SBOM, or dependency-audit gate (notably for the pre-1.0, fast-moving `@flyingrobots/graft 0.10.1` on the highlight critical path). Nothing blocks a compromised or yanked transitive dep from reaching a "release-gate" build.

---

## 3. Final Recommendations & Next Step

### 3.1 Final Ship Recommendation — **NO (as-is).**

Not because the codebase is low quality — it is, by the metrics, excellent. The blocker is specific and narrow: **the file-save path is neither crash-safe (Risk 1) nor conflict-safe (Risk 2), and the process has no crash guard (Risk 3).** For a general-purpose editor that markets *trust, auditability, and recoverability*, shipping a save path that can truncate the user's file on a mid-write crash is a contradiction of the product's core promise. This becomes a **"YES, BUT…"** the moment Risks 1–3 are fixed and covered by tests; none of the three is large.

### 3.2 Prioritized Action Plan

- **Action 1 (High Urgency):** Make saves atomic and conflict-aware — implement temp-write + fsync + rename in `saveEditorFile`, and thread the load-time fingerprint into `saveEditor` for drift detection (**Mitigation Prompts 7 & 8**). This closes the two data-loss ship-stoppers and reuses a pattern already in the repo.
- **Action 2 (Medium Urgency):** Add the top-level crash guard with terminal restore + emergency dirty-buffer swap-save, plus a structured crash diagnostic sink (**Mitigation Prompt 9** + Operational Gaps 1–2). Protects the user's shell and unsaved work in the field.
- **Action 3 (Low Urgency):** Armor the doctrine and the encoding boundary — add the strict ESLint flat config with boundary + max-lines rules wired into CI (TD score §1.1), and tighten non-UTF-8 handling (**Mitigation Prompt 11**). Prevents quality regression and silent corruption over the long maintenance tail.

---

### Evidence Basis

- Save path: `src/adapters/editor-file.ts:50` (`writeFileSync` direct), `src/app/workspace/editor-session.ts:105` (`saveEditor`), `src/app/workspace/workspace-text-commands.ts:361` (export save with preflight).
- Atomic pattern already present: `src/adapters/jedit-wsc-workspace-store.ts` (temp + `rmSync force`).
- External process exec (all `shell: false`, array args): `graft-source-highlighter.ts:157`, `graft-diagnostics-adapter.ts:160/178`, `node-echo-recovery-command.ts:26`, `graft-api-session.ts:284`.
- Crash safety: no `uncaughtException`/`unhandledRejection`/`process.on` handler in `src/`; raw-mode launch at `src/main-workspace.ts:45`.
- Encoding: NULL-byte-only binary detection + lossy `toString('utf8')` at `src/adapters/editor-file.ts:30,38`.
- Type discipline: 1 `any` (comment), 12 `unknown`, 0 `@ts-ignore`, 0 `console.*`, 1 TODO; strict `tsconfig.json`; no ESLint; CI `.github/workflows/ci.yml` = build + sharded tests, no lint/audit gate.
