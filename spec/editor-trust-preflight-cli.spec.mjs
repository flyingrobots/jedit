import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-editor-trust-preflight.mjs');

test('editor trust preflight CLI reports Slice 0 blockers as JSON', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.equal(report.schema, 'jedit.editor-trust-preflight.v1');
  assert.equal(report.cycle, 'WF-0108');
  assert.equal(report.slice, 0);
  assert.equal(report.status, 'blocked');
  assert.deepEqual(report.blockers.map((gate) => gate.id), [
    'dirty-quit-guard',
    'dirty-file-switch-guard',
    'slash-question-search-entry',
  ]);
});
