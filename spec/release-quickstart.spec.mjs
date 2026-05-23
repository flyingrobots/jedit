import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const QUICKSTART_PATH = path.join(REPO_ROOT, 'docs', 'releases', 'v0.1.0', 'quickstart.md');
const WITNESS_SCRIPT = path.join(REPO_ROOT, 'scripts', 'jedit-echo-powered-session.mjs');

test('v0.1.0 quickstart documents executable witness commands', () => {
  const source = readFileSync(QUICKSTART_PATH, 'utf8');

  assert.match(source, /npm run build/);
  assert.match(source, /--json --dry-run/);
  assert.match(source, /--json --replay-local/);
  assert.match(source, /JEDIT_TEXT_RUNTIME=echo npm start/);
  assert.match(source, /"transport": "installed-jedit-contract"/);
  assert.match(source, /"appCanTick": false/);
});

test('v0.1.0 quickstart dry-run command executes', () => {
  const build = spawnSync('npm', ['run', '--silent', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const result = spawnSync(process.execPath, [
    WITNESS_SCRIPT,
    '--json',
    '--dry-run',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.transport, 'installed-jedit-contract');
  assert.equal(summary.plan.appCanTick, false);
});
