import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ensureDistBuilt, REPO_ROOT } from './workspace-helpers.mjs';

test('command provenance witness reports slice 1 Vim command events', async () => {
  await ensureDistBuilt();

  const result = spawnSync(process.execPath, ['scripts/jedit-command-provenance-witness.mjs', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.capability, 'jedit.command-provenance-witness');
  assert.equal(report.outcome, 'applied');
  assert.deepEqual(report.commands.map((entry) => entry.command), ['dw', 'ciw', 'dd', 'gUap']);
  for (const entry of report.commands) {
    assert.equal(entry.outcome, 'applied');
    assert.equal(entry.event.kind, 'vim');
    assert.equal(entry.event.receipt.posture, 'received');
    assert.equal(entry.event.target.rangeEnd > entry.event.target.rangeStart, true);
    assert.match(entry.event.summary, new RegExp(`^${entry.command} `));
  }
});

test('command provenance witness can report one requested command', async () => {
  await ensureDistBuilt();

  const result = spawnSync(process.execPath, [
    'scripts/jedit-command-provenance-witness.mjs',
    '--json',
    '--command',
    'gUap',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.outcome, 'applied');
  assert.equal(report.commands.length, 1);
  assert.equal(report.commands[0].command, 'gUap');
  assert.equal(report.commands[0].event.target.kind, 'textObject');
  assert.equal(report.commands[0].event.target.shape, 'linewise');
});
