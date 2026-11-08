import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'anchor-transform-contract.js');
const CONTRACT_SPEC_PATH = path.join('spec', 'anchor-transform.contract.spec.mjs');
const QUALITY_GATE_PATH = path.join('scripts', 'quality-gate.mjs');
const TYPESCRIPT_CLI_PATH = path.join('node_modules', 'typescript', 'bin', 'tsc');
const EXPECTED_RUNTIME_EXPORTS = [
  'AnchorTransformContractError',
  'createAnchorTransformDelta',
  'createPointAnchor',
  'leftAnchorBias',
  'rightAnchorBias',
  'transformPointAnchor',
];

let cachedContractPromise;

function runCommand(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function loadContract() {
  if (cachedContractPromise === undefined) {
    runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
    cachedContractPromise = import(pathToFileURL(MODULE_PATH).href);
  }

  return cachedContractPromise;
}
test('A left-biased point anchor stays before inserted text at its byte.', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(5, contract.leftAnchorBias());
  const delta = contract.createAnchorTransformDelta(5, 5, 6);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 5);
  assert.equal(result.bias, contract.leftAnchorBias());
});

test('A right-biased point anchor moves after inserted text at its byte.', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(5, contract.rightAnchorBias());
  const delta = contract.createAnchorTransformDelta(5, 5, 6);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 11);
  assert.equal(result.bias, contract.rightAnchorBias());
});

test('A point anchor after a replacement shifts by the replacement byte delta.', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(10, contract.leftAnchorBias());
  const delta = contract.createAnchorTransformDelta(4, 8, 6);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 12);
});

test('A point anchor inside a deleted span collapses to the replacement start.', async () => {
  const contract = await loadContract();
  const anchor = contract.createPointAnchor(6, contract.leftAnchorBias());
  const delta = contract.createAnchorTransformDelta(4, 8, 0);

  const result = contract.transformPointAnchor(anchor, delta);

  assert.equal(result.byte, 4);
});

test('The runtime contract stays a minimal point-anchor seam rather than a full anchor system.', async () => {
  const contract = await loadContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_RUNTIME_EXPORTS);
});

test('The workspace satisfies build, quality, and the anchor transform contract suite.', () => {
  runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
  runCommand(['--test', CONTRACT_SPEC_PATH]);
  runCommand([QUALITY_GATE_PATH, '--json']);
});
