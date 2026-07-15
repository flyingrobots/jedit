import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-production-text-session.mjs');
const INSERT_TEXT = 'cli text';

test('production text session CLI rejects implicit full-snapshot fixture authority', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--text',
    INSERT_TEXT,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--allow-full-snapshot-fixture/);
  assert.doesNotMatch(result.stderr, /graph-backed authority is not installed/);
});

test('production text session CLI reports explicit fixture edit reading checkpoint and export evidence', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--allow-full-snapshot-fixture',
    '--text',
    INSERT_TEXT,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.equal(report.status, 'applied');
  assert.equal(report.exportedText, INSERT_TEXT);
  assert.equal(report.authority.exposesTickAuthority, false);
  assert.match(report.receiptId, /^receipt:/);
  assert.match(report.checkpointId, /^checkpoint:/);
  assert.match(report.readingId, /^text-window:/);
});

test('production text session CLI reports stable local replay posture', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--allow-full-snapshot-fixture',
    '--replay-local',
    '--text',
    INSERT_TEXT,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.equal(report.sameSemanticIdentity, true);
  assert.equal(report.durableReplayClaim, false);
  assert.equal(report.first.status, 'applied');
  assert.equal(report.second.status, 'applied');
});
