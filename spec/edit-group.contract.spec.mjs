import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'edit-group-contract.js');

async function loadContract() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

test('An edit group can close over multiple known ticks.', async () => {
  const contract = await loadContract();
  const withTicks = contract.registerTick(
    contract.registerTick(
      contract.registerTick(contract.createEditGroupState(), 1),
      2,
    ),
    3,
  );

  const grouped = contract.includeTickInOpenGroup(
    contract.includeTickInOpenGroup(
      contract.openEditGroup(withTicks),
      2,
    ),
    3,
  );
  const result = contract.closeEditGroup(grouped);

  assert.deepEqual(result.nextState.groups, [
    {
      id: 1,
      tickIds: [2, 3],
    },
  ]);
  assert.deepEqual(result.receipt, {
    groupId: 1,
    tickIds: [2, 3],
  });
});

test('Only known ticks can enter an edit group.', async () => {
  const contract = await loadContract();
  const state = contract.openEditGroup(contract.createEditGroupState([1, 2]));

  assert.throws(
    () => contract.includeTickInOpenGroup(state, 3),
    (error) => error instanceof contract.EditGroupContractError && error.code === 2,
  );
});

test('Closing an empty open group is a logical no-op.', async () => {
  const contract = await loadContract();
  const state = contract.openEditGroup(contract.createEditGroupState([1, 2]));

  const result = contract.closeEditGroup(state);

  assert.deepEqual(result.nextState.groups, []);
  assert.equal(result.nextState.openGroup, undefined);
  assert.equal(result.receipt, undefined);
});
