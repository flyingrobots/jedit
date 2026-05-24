import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ensureDistBuilt, REPO_ROOT } from './workspace-helpers.mjs';

test('workspace Echo witness reports app-safe operation evidence', async () => {
  await ensureDistBuilt();

  const result = spawnSync(process.execPath, ['scripts/jedit-workspace-echo-witness.mjs', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.capability, 'jedit.workspace.echo-witness');
  assert.equal(report.lifecycleAuthorityExposed, false);
  assert.deepEqual(report.operations, ['open', 'edit', 'read', 'export', 'checkpoint']);
  assert.equal(report.open.bufferId, 'buffer:witness');
  assert.equal(report.edit.receiptId, 'receipt:witness-edit');
  assert.equal(report.export.readingId, 'reading:witness-export');
  assert.equal(report.checkpoint.checkpointId, 'checkpoint:witness');
});

test('workspace Echo witness reports typed obstruction without lifecycle authority', async () => {
  await ensureDistBuilt();

  const result = spawnSync(process.execPath, [
    'scripts/jedit-workspace-echo-witness.mjs',
    '--json',
    '--obstruct',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.lifecycleAuthorityExposed, false);
  assert.equal(report.outcome, 'obstructed');
  assert.equal(report.obstruction.stage, 'open');
  assert.equal(report.obstruction.message, 'workspace witness open obstruction');
});
