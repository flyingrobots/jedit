import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'anchor-transform-contract.js');

async function loadContract() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

test('A left-biased point anchor stays before inserted text at its byte', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(5, contract.leftAnchorBias());
  const receipt = contract.createAnchorTransformReceipt(5, 5, 6);

  const result = contract.transformPointAnchor(anchor, receipt);

  assert.equal(result.byte, 5);
  assert.equal(result.bias, contract.leftAnchorBias());
});

test('A right-biased point anchor moves after inserted text at its byte', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(5, contract.rightAnchorBias());
  const receipt = contract.createAnchorTransformReceipt(5, 5, 6);

  const result = contract.transformPointAnchor(anchor, receipt);

  assert.equal(result.byte, 11);
  assert.equal(result.bias, contract.rightAnchorBias());
});

test('A point anchor after a replacement shifts by the replacement byte delta', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(10, contract.leftAnchorBias());
  const receipt = contract.createAnchorTransformReceipt(4, 8, 6);

  const result = contract.transformPointAnchor(anchor, receipt);

  assert.equal(result.byte, 12);
});

test('A point anchor inside a deleted span collapses to the replacement start', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(6, contract.leftAnchorBias());
  const receipt = contract.createAnchorTransformReceipt(4, 8, 0);

  const result = contract.transformPointAnchor(anchor, receipt);

  assert.equal(result.byte, 4);
});
