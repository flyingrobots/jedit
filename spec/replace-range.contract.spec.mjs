import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js');

async function loadContract() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

test('ReplaceRange inserts a fragment and satisfies the materialization law', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot('hello world');
  const fragment = contract.createTextFragment(' brave new');
  const range = contract.createTextRange(5, 5);

  const result = contract.replaceRange(baseRoot, range, fragment);

  assert.equal(contract.materializeRoot(result.nextRoot), 'hello brave new world');
  assert.equal(result.receipt?.baseRootId, baseRoot.id);
  assert.equal(result.receipt?.insertedRootId, fragment.root.id);
});

test('ReplaceRange deletes a range when given the empty fragment', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot('hello brave new world');
  const range = contract.createTextRange(5, 15);

  const result = contract.replaceRange(baseRoot, range, contract.emptyFragment());

  assert.equal(contract.materializeRoot(result.nextRoot), 'hello world');
});

test('ReplaceRange returns the same root and no receipt for a logical no-op', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot('hello');
  const range = contract.createTextRange(0, 5);
  const fragment = contract.createTextFragment('hello');

  const result = contract.replaceRange(baseRoot, range, fragment);

  assert.equal(result.nextRoot.id, baseRoot.id);
  assert.equal(result.receipt, undefined);
});
