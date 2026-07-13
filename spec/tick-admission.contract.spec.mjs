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

async function loadText() {
  await ensureDistBuilt();

  return import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
}

test('Admitting a ReplaceRange mints a tick and advances the current root.', async () => {
  const contract = await loadContract();
  const text = await loadText();
  const initialRoot = text.createBufferRoot(text.FIRST_ROOT_ID, 'hello world');
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(5, 5),
    ' brave new',
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
  const text = await loadText();
  const initialRoot = text.createBufferRoot(text.FIRST_ROOT_ID, 'hello world');
  const range = text.createTextRange(5, 5);
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(state, range, ' brave new');

  assert.equal(result.receipt?.replaceReceipt.baseRootId, initialRoot.id);
  assert.equal(result.receipt?.replaceReceipt.nextRootId, result.nextState.currentRoot.id);
  assert.equal(result.receipt?.replaceReceipt.insertedRootId, state.nextRootId);
});

test('Tick admission threads the next root id through admitted states.', async () => {
  const contract = await loadContract();
  const text = await loadText();
  const initialRoot = text.createBufferRoot(text.FIRST_ROOT_ID, 'hello world');
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(5, 5),
    ' brave new',
  );

  assert.equal(state.nextRootId, initialRoot.id + 1);
  assert.equal(result.nextState.currentRoot.id, initialRoot.id + 2);
  assert.equal(result.nextState.nextRootId, initialRoot.id + 3);
});

test('A logical no-op does not mint a tick.', async () => {
  const contract = await loadContract();
  const text = await loadText();
  const initialRoot = text.createBufferRoot(text.FIRST_ROOT_ID, 'hello');
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(0, 5),
    'hello',
  );

  assert.equal(result.nextState, state);
  assert.equal(result.receipt, undefined);
});
