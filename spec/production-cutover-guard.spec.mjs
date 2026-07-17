import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const GUARD_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-production-cutover-guard.mjs');
const GUARD_TIMEOUT_MS = 15_000;
const GUARD_MAX_BUFFER_BYTES = 1024 * 1024;

test('production cutover guard passes current production session files', () => {
  const result = spawnGuard();

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /production cutover guard ok/);
});

test('production cutover guard catches sample legacy bypass tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-cutover-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "import { loadEditor } from './editor-session.js';",
    'const leaked = editor.lines;',
    'lifecycle.requestRunUntilIdle();',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /loadEditor/);
  assert.match(result.stderr, /editor\.lines/);
  assert.match(result.stderr, /requestRunUntilIdle/);
});

test('production cutover guard catches sample recovery local-memory fallback tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-recovery-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "import { createFullSnapshotHotTextRuntimeFixture } from './full-snapshot-hot-text-runtime-fixture.js';",
    'const text = getCurrentText(currentBuffer);',
    'saveFromBuffer(text);',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /createFullSnapshotHotTextRuntimeFixture/);
  assert.match(result.stderr, /getCurrentText/);
  assert.match(result.stderr, /saveFromBuffer/);
});

test('production cutover guard catches sample full-snapshot fixture authority tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-fixture-authority-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "import type { FullSnapshotHotTextRuntimeFixture } from './full-snapshot-hot-text-runtime-fixture.js';",
    "import { isFullSnapshotHotTextRuntimeFixture } from './full-snapshot-hot-text-runtime-fixture.js';",
    'const runtime: FullSnapshotHotTextRuntimeFixture | null = null;',
    'const fixture = runtime != null && isFullSnapshotHotTextRuntimeFixture(runtime);',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FullSnapshotHotTextRuntimeFixture/);
  assert.match(result.stderr, /isFullSnapshotHotTextRuntimeFixture/);
  assert.match(result.stderr, /full-snapshot-hot-text-runtime-fixture/);
});

test('production cutover guard catches sample legacy hot runtime fixture tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-recovery-legacy-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "import { createInMemoryHotTextRuntime } from './in-memory-hot-text-runtime.js';",
    'const runtime = createInMemoryHotTextRuntime();',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /createInMemoryHotTextRuntime/);
  assert.match(result.stderr, /in-memory-hot-text-runtime/);
});

test('production cutover guard catches sample fake Echo fixture transport tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-fake-transport-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "import { createFakeEchoJeditOpticTransport } from './fake-echo-jedit-optic-transport.js';",
    'const transport = createFakeEchoJeditOpticTransport();',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /createFakeEchoJeditOpticTransport/);
  assert.match(result.stderr, /fake-echo-jedit-optic-transport/);
});

test('production cutover guard catches every production-local authority constructor', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-local-authority-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    'const state = createInMemoryJeditContractStatePort();',
    'const recovery = createFakeEchoRecoveryPort([]);',
    'const transport = createInstalledJeditContractEchoTransport();',
    'const authority = createGraphRopeHotTextAuthority();',
    'const runtime = createGraphRopeRuntime({ hash });',
    'const local: HotTextRuntimePort = runtime;',
    'const state: HotTextBufferState = runtime.createBuffer();',
    'const session: TextBufferSessionPort = runtime;',
    'const optic: TextBufferOptic = session.getBufferOptic(bufferId);',
    'const result = optic.applyIntent(intent);',
    'const undoStack = [];',
    'const redoStack = [];',
    'const packageDescriptor = jeditHotTextContractPackage();',
    'const envelope = createJeditRuntimeWorkEnvelope(input, hash);',
    'const ticket = createJeditTicketedRuntimeIngress(input);',
    'const ledger = createJeditSubmissionLedger();',
    'const correlation = createJeditReceiptCorrelation();',
    'const loop = createTrustedEchoRuntimeLoop(options);',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /createInMemory production implementation/);
  assert.match(result.stderr, /createFake production implementation/);
  assert.match(result.stderr, /createInstalledJeditContractEchoTransport/);
  assert.match(result.stderr, /createGraphRopeHotTextAuthority/);
  assert.match(result.stderr, /createGraphRopeRuntime/);
  assert.match(result.stderr, /HotTextRuntimePort/);
  assert.match(result.stderr, /HotTextBufferState/);
  assert.match(result.stderr, /handwritten text session port/);
  assert.match(result.stderr, /handwritten text optic mutation/);
  assert.match(result.stderr, /process-local editor undo stack/);
  assert.match(result.stderr, /process-local editor redo stack/);
  assert.match(result.stderr, /local contract package descriptor/);
  assert.match(result.stderr, /local runtime work envelope/);
  assert.match(result.stderr, /local ticketed work/);
  assert.match(result.stderr, /local submission ledger/);
  assert.match(result.stderr, /local receipt correlation/);
  assert.match(result.stderr, /local trusted runtime loop/);
});

test('production cutover guard catches test-only implementation filenames', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-local-authority-name-guard-'));
  const sample = path.join(tempDir, 'fake-echo-authority.ts');
  writeFileSync(sample, 'export const authority = null;\n');

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /test-only implementation filename is forbidden/);
});

test('production cutover guard catches sample hot-buffer full-root helper tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-hot-buffer-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "import { materializeHotBuffer, startHotBufferSession } from './hot-buffer-session.js';",
    'const roots = HotTextBufferState.roots;',
    'const text = materializeHotBuffer(buffer);',
    'const session = startHotBufferSession(runtime);',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /materializeHotBuffer/);
  assert.match(result.stderr, /startHotBufferSession/);
  assert.match(result.stderr, /hot-buffer-session/);
  assert.match(result.stderr, /HotTextBufferState\.roots/);
});

test('production cutover guard catches sample line-array save and Git-diff modified-line tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-materialized-policy-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    'saveEditorLines(editor.lines);',
    'const modified = gitDiffModifiedLines(filePath);',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /editor line array save/);
  assert.match(result.stderr, /Git diff modified lines/);
});

test('production cutover guard catches sample non-Echo runtime profile tokens', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'jedit-runtime-profile-guard-'));
  const sample = path.join(tempDir, 'sample.ts');
  writeFileSync(sample, [
    "export const TEXT_RUNTIME_PROFILE_TEST_LOCAL = 'testLocal';",
    'const fallbackProfile = TEXT_RUNTIME_PROFILE_TEST_LOCAL;',
    'const testLocalSessionFactory = defaultTestLocalSessionFactory();',
  ].join('\n'));

  const result = spawnGuard('--sample-forbidden-file', sample);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEXT_RUNTIME_PROFILE_TEST_LOCAL/);
  assert.match(result.stderr, /testLocal profile/);
  assert.match(result.stderr, /fallbackProfile/);
  assert.match(result.stderr, /testLocalSessionFactory/);
  assert.match(result.stderr, /defaultTestLocalSessionFactory/);
});

test('production cutover guard reports missing guarded source files as failures', () => {
  const missing = path.join(tmpdir(), 'jedit-cutover-missing-file.ts');

  const result = spawnGuard('--sample-forbidden-file', missing);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing guarded production cutover file/);
  assert.match(result.stderr, /jedit-cutover-missing-file\.ts/);
});

function spawnGuard(...args) {
  return spawnSync(process.execPath, [
    GUARD_PATH,
    ...args,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: GUARD_MAX_BUFFER_BYTES,
    timeout: GUARD_TIMEOUT_MS,
  });
}
