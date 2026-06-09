import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const GUIDE_PATH = path.join(REPO_ROOT, 'docs', 'echo-application-hosting-guide.md');

test('Echo application hosting guide names current ports and no app tick authority', () => {
  const source = readFileSync(GUIDE_PATH, 'utf8');

  assert.match(source, /TextBufferSessionPort/);
  assert.match(source, /TrustedEchoRuntimeLifecyclePort/);
  assert.match(source, /EchoContractPackageHostPort/);
  assert.match(source, /JeditRestartRecoveryPort/);
  assert.match(source, /Query observers do not receive mutable runtime/);
  assert.match(source, /Durability And Historical Export Template/);
  assert.match(source, /Graft\/Think Readiness Checklist/);
  assert.match(source, /semantic replay comparison that excludes wall-clock cadence/);
  assert.match(source, /Fake-port fixtures are allowed only/);
  assert.match(source, /Wesley owns: generated helper material/);
  assert.match(source, /minimum release gate covering package identity/);
  assert.doesNotMatch(source, /\+tick\(\)/);
  assert.doesNotMatch(source, /application-controlled ticking/i);
});

test('Echo application hosting guide counter witness command is executable', () => {
  const result = spawnSync(process.execPath, [
    '--test',
    '--test-concurrency=1',
    'spec/echo-hosting-counter-template.spec.mjs',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
