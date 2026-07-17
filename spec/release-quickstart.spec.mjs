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
const CUTOVER_GUARD = path.join(REPO_ROOT, 'scripts', 'jedit-production-cutover-guard.mjs');

test('v0.1.0 quickstart revokes the retired local witness claim', () => {
  const source = readFileSync(QUICKSTART_PATH, 'utf8');

  assert.match(source, /npm run build/);
  assert.match(source, /jedit-production-cutover-guard\.mjs/);
  assert.match(source, /npm run witness:echo/);
  assert.match(source, /npm start/);
  assert.match(source, /real Echo WASM module/);
  assert.match(source, /generated Jim Edict package/);
  assert.match(source, /Nothing shorter may be described as Echo-powered/);
  assert.doesNotMatch(source, /allow-full-snapshot-fixture/);
});

test('v0.1.0 release docs identify the invalidated authority claim', () => {
  const source = readFileSync(RELEASE_README_PATH, 'utf8');

  assert.match(source, /retired and invalidated/);
  assert.match(source, /process-local TypeScript/);
  assert.match(source, /real Echo WASM kernel/);
  assert.match(source, /generated Jim Edict operations/);
  assert.match(source, /Echo remains generic/);
  assert.match(source, /must not be cited as proof/);
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

test('v0.1.0 quickstart cutover guard command executes', () => {
  const result = spawnSync(process.execPath, [
    CUTOVER_GUARD,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'jedit production cutover guard ok\n');
});
