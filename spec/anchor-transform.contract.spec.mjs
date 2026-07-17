import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'anchor-transform-contract.js');

async function loadContract() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

test('A left-biased point anchor stays before inserted text at its byte', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(5, contract.leftAnchorBias());
  const delta = contract.createAnchorTransformDelta(5, 5, 6);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 5);
  assert.equal(result.bias, contract.leftAnchorBias());
});

test('A right-biased point anchor moves after inserted text at its byte', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(5, contract.rightAnchorBias());
  const delta = contract.createAnchorTransformDelta(5, 5, 6);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 11);
  assert.equal(result.bias, contract.rightAnchorBias());
});

test('A point anchor after a replacement shifts by the replacement byte delta', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(10, contract.leftAnchorBias());
  const delta = contract.createAnchorTransformDelta(4, 8, 6);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 12);
});

test('A point anchor inside a deleted span collapses to the replacement start', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(6, contract.leftAnchorBias());
  const delta = contract.createAnchorTransformDelta(4, 8, 0);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 4);
});
