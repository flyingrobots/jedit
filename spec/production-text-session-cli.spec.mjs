import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-production-text-session.mjs');
const INSERT_TEXT = 'cli text';
const FULL_SNAPSHOT_AUTHORITY_ENV = 'JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY';

test('production text session CLI reports edit reading checkpoint and export evidence', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--text',
    INSERT_TEXT,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: fullSnapshotAuthorityEnv(),
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
    '--replay-local',
    '--text',
    INSERT_TEXT,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: fullSnapshotAuthorityEnv(),
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.equal(report.sameSemanticIdentity, true);
  assert.equal(report.durableReplayClaim, false);
  assert.equal(report.first.status, 'applied');
  assert.equal(report.second.status, 'applied');
});

function fullSnapshotAuthorityEnv() {
  return {
    ...process.env,
    [FULL_SNAPSHOT_AUTHORITY_ENV]: '1',
  };
}
