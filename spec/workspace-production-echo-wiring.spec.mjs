import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { importDist, REPO_ROOT } from './workspace-helpers.mjs';

const MISSING_ECHO_MODULE = '@flyingrobots/jedit-echo-wasm-missing-witness';

test('workspace production text session remains obstructed at the generated-operation boundary', async () => {
  const adapter = await importDist('adapters', 'workspace-production-text-session.js');
  const session = adapter.createWorkspaceProductionTextSession({
    kernelInfo() {
      return { moduleSpecifier: 'test-only:no-authority' };
    },
    submitIntentBytes() {
      throw new Error('production obstruction must not submit through a handwritten corridor');
    },
    observeBytes() {
      throw new Error('production obstruction must not observe through a handwritten corridor');
    },
    schedulerStatusBytes() {
      throw new Error('production obstruction must not inspect a handwritten scheduler corridor');
    },
  });

  const outcome = await session.openBuffer({
    bufferKey: 'witness.txt',
    initialText: '',
    atMs: 7,
  });

  assert.equal(outcome.kind, 'obstructed');
  assert.match(outcome.obstruction.issue.message, /Echo kernel test-only:no-authority is initialized/);
  assert.match(outcome.obstruction.issue.message, /generated Jim Edict package/);
});

test('workspace startup refuses to run without the configured Jim Echo WASM module', () => {
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'dist', 'main.js')], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      JEDIT_ECHO_WASM_MODULE: MISSING_ECHO_MODULE,
    },
    encoding: 'utf8',
    timeout: 15_000,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Echo wasm module could not be loaded/);
  assert.match(result.stderr, new RegExp(MISSING_ECHO_MODULE.replaceAll('/', '\\/')));
});
