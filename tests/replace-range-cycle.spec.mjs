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
  '0001-replace-range-contract',
  'replace-range-contract.md',
);
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js');
const CONTRACT_SPEC_PATH = path.join('spec', 'replace-range.contract.spec.mjs');
const QUALITY_GATE_PATH = path.join('scripts', 'quality-gate.mjs');
const TYPESCRIPT_CLI_PATH = path.join('node_modules', 'typescript', 'bin', 'tsc');
const EXPECTED_RUNTIME_EXPORTS = [
  'FIRST_ROOT_ID',
  'TextEditContractError',
  'createBufferRoot',
  'createTextFragment',
  'createTextPoint',
  'createTextRange',
  'emptyFragment',
  'firstPoint',
  'materializeRoot',
  'replaceRange',
];
const BASE_ROOT_ID = 1;
const FRAGMENT_ROOT_ID = 2;
const NEXT_ROOT_ID = 3;

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

test('ReplaceRange is named as the first kernel seam in this cycle.', () => {
  const designDoc = readDesignDoc();

  assert.match(designDoc, /ReplaceRange is named as the first kernel seam in this cycle\./);
  assert.match(
    designDoc,
    /first explicit, executable seam of the future\s+Echo-backed text kernel/i,
  );
});

test('This cycle pins down insert/materialization, delete-by-empty-fragment, and logical no-op.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /This cycle pins down insert\/materialization, delete-by-empty-fragment,\s+and logical no-op\./,
  );
  assert.match(designDoc, /inserting a fragment satisfies the materialization law/i);
  assert.match(designDoc, /deleting text is just replacement by the empty fragment/i);
  assert.match(designDoc, /replacing a range with identical logical text is a no-op/i);
});

test('This cycle limits scope to the minimal ReplaceRange seam.', () => {
  const designDoc = readDesignDoc();

  assert.match(designDoc, /This cycle limits scope to the minimal ReplaceRange seam\./);
  assert.match(
    designDoc,
    /This cycle\s+still does not require persistent rope storage, anchors, strands, or\s+admission\./,
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

test('ReplaceRange insertion satisfies the materialization law.', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot(BASE_ROOT_ID, 'hello world');
  const fragment = contract.createTextFragment(FRAGMENT_ROOT_ID, ' brave new');
  const range = contract.createTextRange(5, 5);

  const result = contract.replaceRange(baseRoot, range, fragment, NEXT_ROOT_ID);

  assert.equal(contract.materializeRoot(result.nextRoot), 'hello brave new world');
  assert.equal(result.receipt?.baseRootId, baseRoot.id);
  assert.equal(result.receipt?.insertedRootId, fragment.root.id);
});

test('ReplaceRange deletion is replacement by the empty fragment.', async () => {
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

test('ReplaceRange returns the same root and no receipt for a logical no-op.', async () => {
  const contract = await loadContract();
  const baseRoot = contract.createBufferRoot(BASE_ROOT_ID, 'hello');
  const range = contract.createTextRange(0, 5);
  const fragment = contract.createTextFragment(FRAGMENT_ROOT_ID, 'hello');

  const result = contract.replaceRange(baseRoot, range, fragment, NEXT_ROOT_ID);

  assert.equal(result.nextRoot.id, baseRoot.id);
  assert.equal(result.receipt, undefined);
});

test('The runtime contract stays a minimal ReplaceRange seam rather than a full rope engine.', async () => {
  const contract = await loadContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_RUNTIME_EXPORTS);
});

test('The workspace satisfies build, quality, and the ReplaceRange contract suite.', () => {
  runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
  runCommand(['--test', CONTRACT_SPEC_PATH]);
  runCommand([QUALITY_GATE_PATH, '--json']);
});
