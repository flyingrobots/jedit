import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-editor-trust-preflight.mjs');
const HELP_TEXT = 'Usage: node scripts/jedit-editor-trust-preflight.mjs --json\n';

test('editor trust preflight CLI reports Slice 0 blockers as JSON', () => {
  const result = runCli(['--json']);

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

test('editor trust preflight CLI resolves dist from the script path', () => {
  const result = runCli(['--json'], path.join(REPO_ROOT, 'docs'));

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.equal(report.schema, 'jedit.editor-trust-preflight.v1');
});

test('editor trust preflight CLI prints help without requiring dist import', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, HELP_TEXT);
  assert.equal(result.stderr, '');
});

test('editor trust preflight CLI rejects unknown arguments', () => {
  const result = runCli(['--wat']);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `unknown argument: --wat\n${HELP_TEXT}`);
});

test('editor trust preflight CLI requires explicit JSON output', () => {
  const result = runCli([]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `error: --json is required\n${HELP_TEXT}`);
});

function runCli(args, cwd = REPO_ROOT) {
  return spawnSync(process.execPath, [
    CLI_PATH,
    ...args,
  ], {
    cwd,
    encoding: 'utf8',
  });
}
