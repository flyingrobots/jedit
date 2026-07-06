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
