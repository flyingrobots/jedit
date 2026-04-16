import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'save-checkpoint-contract.js');

async function loadContract() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

test('Save creates a checkpoint without changing the current root.', async () => {
  const contract = await loadContract();
  const state = contract.createSaveCheckpointState(7, 'notes/today.md', [3, 4, 5]);

  const result = contract.saveCheckpoint(state);

  assert.equal(result.nextState.currentRootId, 7);
  assert.deepEqual(result.nextState.checkpoints, [
    {
      id: 1,
      rootId: 7,
      path: 'notes/today.md',
    },
  ]);
  assert.equal(result.receipt?.checkpointId, 1);
});

test('Save preserves tick history rather than clearing it.', async () => {
  const contract = await loadContract();
  const state = contract.createSaveCheckpointState(7, 'notes/today.md', [11, 12, 13]);

  const result = contract.saveCheckpoint(state);

  assert.deepEqual(result.nextState.tickIds, [11, 12, 13]);
});

test('Saving the same head twice is a logical no-op.', async () => {
  const contract = await loadContract();
  const initial = contract.createSaveCheckpointState(9, 'src/main.ts', [21]);
  const firstSave = contract.saveCheckpoint(initial);
  const secondSave = contract.saveCheckpoint(firstSave.nextState);

  assert.equal(secondSave.nextState, firstSave.nextState);
  assert.equal(secondSave.receipt, undefined);
});
