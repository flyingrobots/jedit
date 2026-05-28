import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const QUICKSTART_PATH = path.join(REPO_ROOT, 'docs', 'releases', 'v0.1.0', 'quickstart.md');
const RELEASE_README_PATH = path.join(REPO_ROOT, 'docs', 'releases', 'v0.1.0', 'README.md');
const FINAL_WITNESS_PATH = path.join(REPO_ROOT, 'docs', 'releases', 'v0.1.0', 'final-witness-report.json');
const LOCAL_REPLAY_PATH = path.join(REPO_ROOT, 'docs', 'releases', 'v0.1.0', 'local-replay-report.json');
const WITNESS_SCRIPT = path.join(REPO_ROOT, 'scripts', 'jedit-echo-powered-session.mjs');

test('v0.1.0 quickstart documents executable witness commands', () => {
  const source = readFileSync(QUICKSTART_PATH, 'utf8');

  assert.match(source, /npm run build/);
  assert.match(source, /--json --dry-run/);
  assert.match(source, /--json --replay-local/);
  assert.match(source, /jedit-production-text-session\.mjs --json/);
  assert.match(source, /JEDIT_TEXT_RUNTIME=echoHosted npm start/);
  assert.match(source, /testLocal.*dev\/test fixture/);
  assert.match(source, /"transport": "installed-jedit-contract"/);
  assert.match(source, /"appCanTick": false/);
});

test('v0.1.0 release docs name evidence commands non-goals and Echo generic boundary', () => {
  const source = readFileSync(RELEASE_README_PATH, 'utf8');

  assert.match(source, /npm run release-gate:jedit-echo/);
  assert.match(source, /Echo remains generic/);
  assert.match(source, /No full Continuum transport/);
  assert.match(source, /No full observer-rights or revelation lattice/);
  assert.match(source, /No jedit nouns in Echo core/);
});

test('v0.1.0 closeout records final witness and local replay reports', () => {
  const finalWitness = JSON.parse(readFileSync(FINAL_WITNESS_PATH, 'utf8'));
  const localReplay = JSON.parse(readFileSync(LOCAL_REPLAY_PATH, 'utf8'));

  assert.equal(finalWitness.ok, true);
  assert.equal(finalWitness.report.outcome.status, 'APPLIED');
  assert.equal(finalWitness.report.restartPosture.acceptedSubmissionRecovery, 'UNAVAILABLE');
  assert.equal(localReplay.replayLocal.status, 'MATCH');
  assert.equal(localReplay.replayLocal.wallClockCadenceSemantic, false);
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
