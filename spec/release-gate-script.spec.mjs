import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const RELEASE_GATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'jedit-echo-release-gate.mjs');

test('package exposes the jedit Echo release-gate script', () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));

  assert.equal(packageJson.scripts['release-gate:echo'], 'node scripts/jedit-echo-release-gate.mjs');
});

test('release-gate script validates required package descriptor metadata', () => {
  const result = spawnSync(process.execPath, [
    RELEASE_GATE_SCRIPT,
    '--metadata-only',
    '--package-descriptor',
    'missing/package.ts',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing package descriptor/);
});

test('release-gate script validates required observer witness metadata', () => {
  const result = spawnSync(process.execPath, [
    RELEASE_GATE_SCRIPT,
    '--metadata-only',
    '--observer-witness',
    'missing/observer.spec.mjs',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing observer witness/);
});

test('release-gate script metadata check passes with current required files', () => {
  const result = spawnSync(process.execPath, [
    RELEASE_GATE_SCRIPT,
    '--metadata-only',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /metadata ok/);
});
