import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js');

const BASE_ROOT_ID = 1;
const FRAGMENT_ROOT_ID = 2;
const NEXT_ROOT_ID = 3;

async function loadContract() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

test('ReplaceRange inserts a fragment and satisfies the materialization law', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot(BASE_ROOT_ID, 'hello world');
  const fragment = contract.createTextFragment(FRAGMENT_ROOT_ID, ' brave new');
  const range = contract.createTextRange(5, 5);

  const result = contract.replaceRange(baseRoot, range, fragment, NEXT_ROOT_ID);

  assert.equal(contract.materializeRoot(result.nextRoot), 'hello brave new world');
  assert.equal(result.nextRoot.id, NEXT_ROOT_ID);
  assert.equal(result.receipt?.baseRootId, baseRoot.id);
  assert.equal(result.receipt?.insertedRootId, fragment.root.id);
});

test('ReplaceRange deletes a range when given the empty fragment', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot(BASE_ROOT_ID, 'hello brave new world');
  const range = contract.createTextRange(5, 15);

  const result = contract.replaceRange(
    baseRoot,
    range,
    contract.emptyFragment(FRAGMENT_ROOT_ID),
    NEXT_ROOT_ID,
  );

  assert.equal(contract.materializeRoot(result.nextRoot), 'hello world');
});

test('ReplaceRange returns the same root and no receipt for a logical no-op', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot(BASE_ROOT_ID, 'hello');
  const range = contract.createTextRange(0, 5);
  const fragment = contract.createTextFragment(FRAGMENT_ROOT_ID, 'hello');

  const result = contract.replaceRange(baseRoot, range, fragment, NEXT_ROOT_ID);

  assert.equal(result.nextRoot.id, baseRoot.id);
  assert.equal(result.receipt, undefined);
});

test('ReplaceRange rejects non-positive next root ids before rewriting.', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot(BASE_ROOT_ID, 'hello');
  const range = contract.createTextRange(0, 5);
  const fragment = contract.createTextFragment(FRAGMENT_ROOT_ID, 'goodbye');

  assert.throws(
    () => contract.replaceRange(baseRoot, range, fragment, 0),
    { name: 'TextEditContractError' },
  );
});
