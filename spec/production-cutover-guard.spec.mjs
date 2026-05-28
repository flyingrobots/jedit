import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const GUARD_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-production-cutover-guard.mjs');

test('production cutover guard passes current production session files', () => {
  const result = spawnSync(process.execPath, [GUARD_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

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

  const result = spawnSync(process.execPath, [
    GUARD_PATH,
    '--sample-forbidden-file',
    sample,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /loadEditor/);
  assert.match(result.stderr, /editor\.lines/);
  assert.match(result.stderr, /requestRunUntilIdle/);
});
