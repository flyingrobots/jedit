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

  assert.equal(packageJson.scripts['release-gate:jedit-echo'], 'node scripts/jedit-echo-release-gate.mjs');
  assert.equal(packageJson.scripts['release-gate:echo'], 'npm run release-gate:jedit-echo');
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

test('release-gate script includes hosting replay and static guard witnesses', () => {
  const source = readFileSync(RELEASE_GATE_SCRIPT, 'utf8');

  assert.match(source, /spec\/echo-powered-session-witness-cli\.spec\.mjs/);
  assert.match(source, /spec\/jedit-local-replay-proof\.spec\.mjs/);
  assert.match(source, /spec\/echo-application-hosting-guide\.spec\.mjs/);
  assert.match(source, /spec\/jedit-restart-recovery\.spec\.mjs/);
  assert.match(source, /spec\/text-runtime-profile-session\.spec\.mjs/);
  assert.match(source, /spec\/production-text-session\.spec\.mjs/);
  assert.match(source, /spec\/production-text-session-witness\.spec\.mjs/);
  assert.match(source, /spec\/production-text-session-cli\.spec\.mjs/);
  assert.match(source, /spec\/workspace-text-cutover\.spec\.mjs/);
  assert.match(source, /spec\/workspace-app-echo-cutover\.spec\.mjs/);
  assert.match(source, /spec\/workspace-text-boundaries\.spec\.mjs/);
  assert.match(source, /spec\/workspace-echo-witness-cli\.spec\.mjs/);
  assert.match(source, /spec\/jedit-wsc-restart-round-trip\.spec\.mjs/);
  assert.match(source, /spec\/production-cutover-guard\.spec\.mjs/);
  assert.match(source, /jedit-production-cutover-guard\.mjs/);
  assert.match(source, /npm', \['run', '--silent', 'quality'\]/);
});
