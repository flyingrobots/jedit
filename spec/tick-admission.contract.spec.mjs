import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'tick-admission-contract.js');

async function loadContract() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

test('Admitting a ReplaceRange mints a tick and advances the current root.', async () => {
  const contract = await loadContract();
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const initialRoot = text.createBufferRoot('hello world');
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(5, 5),
    text.createTextFragment(' brave new'),
  );

  assert.equal(text.materializeRoot(result.nextState.currentRoot), 'hello brave new world');
  assert.deepEqual(result.nextState.ticks, [
    {
      id: 1,
      rootId: result.nextState.currentRoot.id,
    },
  ]);
  assert.equal(result.receipt?.tickId, 1);
});

test('Tick admission carries the ReplaceRange receipt as its causal witness.', async () => {
  const contract = await loadContract();
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const initialRoot = text.createBufferRoot('hello world');
  const fragment = text.createTextFragment(' brave new');
  const range = text.createTextRange(5, 5);
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(state, range, fragment);

  assert.equal(result.receipt?.replaceReceipt.baseRootId, initialRoot.id);
  assert.equal(result.receipt?.replaceReceipt.nextRootId, result.nextState.currentRoot.id);
  assert.equal(result.receipt?.replaceReceipt.insertedRootId, fragment.root.id);
});

test('A logical no-op does not mint a tick.', async () => {
  const contract = await loadContract();
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const initialRoot = text.createBufferRoot('hello');
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(0, 5),
    text.createTextFragment('hello'),
  );

  assert.equal(result.nextState, state);
  assert.equal(result.receipt, undefined);
});
