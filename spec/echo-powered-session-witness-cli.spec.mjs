import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-echo-powered-session.mjs');

test('Echo-powered session CLI reports app capability, lifecycle, and reading evidence', () => {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--text',
    'hello',
    '--cycle-limit',
    '6',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.transport, 'fake-echo-shaped');
  assert.equal(summary.authority.appFacingCapability, 'TextBufferOptic');
  assert.equal(summary.authority.appCanTick, false);
  assert.deepEqual(summary.lifecycleRequests, [
    { cycleLimit: 6 },
    { cycleLimit: 6 },
  ]);
  assert.deepEqual(summary.stopRequests, [
    { requested: true },
  ]);
  assert.deepEqual(summary.shutdown, {
    accepted: true,
    lastRunCompletion: 'stopped',
    appCanTick: false,
  });
  assert.equal(summary.report.text, 'hello');
  assert.equal(typeof summary.report.receiptId, 'string');
  assert.equal(typeof summary.report.readingId, 'string');
  assert.equal(summary.report.truncated, false);
});

test('Echo-powered session CLI rejects invalid cycle limits as JSON failures', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--cycle-limit',
    '0',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, false);
  assert.equal(summary.message, 'invalid cycle limit: 0');
});
