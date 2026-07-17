import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const DESIGN_DOC_PATH = path.join(
  REPO_ROOT,
  'docs',
  'design',
  '0002-anchor-transform-semantics',
  'anchor-transform-semantics.md',
);
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

function readDesignDoc() {
  return fs.readFileSync(DESIGN_DOC_PATH, 'utf8');
}

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

test('Anchor transforms are defined in terms of logical ReplaceRange deltas rather than rope maintenance.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /Anchor transforms are defined in terms of logical ReplaceRange deltas\s+rather than rope maintenance\./,
  );
  assert.match(designDoc, /logical ReplaceRange deltas/i);
  assert.match(designDoc, /rope-maintenance\s+semantics/i);
});

test('This cycle pins down left-bias, right-bias, forward shift, and collapse semantics for point anchors.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /This cycle pins down left-bias, right-bias, forward shift, and collapse\s+semantics for point anchors\./,
  );
  assert.match(designDoc, /left-biased point anchor stays before inserted text/i);
  assert.match(designDoc, /right-biased point anchor moves after inserted text/i);
  assert.match(designDoc, /replacement shifts by the replacement byte delta/i);
  assert.match(designDoc, /deleted span collapses to the replacement start/i);
});

test('This cycle limits scope to point anchors over ReplaceRange deltas.', () => {
  const designDoc = readDesignDoc();

  assert.match(designDoc, /This cycle limits scope to point anchors over ReplaceRange deltas\./);
  assert.match(
    designDoc,
    /This cycle\s+does not implement interval anchors, anchor persistence, rope-maintenance\s+semantics, or editor UI integration\./,
  );
  assert.match(designDoc, /Non-goals/);
});

test('This cycle makes accessibility, localization, and agent inspectability explicit.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /This cycle makes accessibility, localization, and agent inspectability\s+explicit\./,
  );
  assert.match(designDoc, /Accessibility and Assistive Reading/);
  assert.match(designDoc, /Localization and Directionality/);
  assert.match(designDoc, /Agent Inspectability and Explainability/);
});

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
