import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('quality gate holds the current baseline without regression', () => {
  const result = spawnSync(process.execPath, ['scripts/quality-gate.mjs', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.ok(Array.isArray(parsed.regressions));
  assert.equal(parsed.regressions.length, 0);
});
