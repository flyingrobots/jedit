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
  '0003-echo-backed-rope-worldline-contract',
  'echo-backed-rope-worldline-contract.md',
);
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'save-checkpoint-contract.js');
const TICK_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'tick-admission-contract.js');
const CONTRACT_SPEC_PATH = path.join('spec', 'save-checkpoint.contract.spec.mjs');
const TICK_CONTRACT_SPEC_PATH = path.join('spec', 'tick-admission.contract.spec.mjs');
const QUALITY_GATE_PATH = path.join('scripts', 'quality-gate.mjs');
const TYPESCRIPT_CLI_PATH = path.join('node_modules', 'typescript', 'bin', 'tsc');
const EXPECTED_RUNTIME_EXPORTS = [
  'SaveCheckpointContractError',
  'createSaveCheckpointState',
  'saveCheckpoint',
];
const EXPECTED_TICK_RUNTIME_EXPORTS = [
  'TickAdmissionContractError',
  'admitReplaceRangeTick',
  'createTickAdmissionState',
];

let cachedContractPromise;
let cachedTickContractPromise;

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

async function loadTickContract() {
  if (cachedTickContractPromise === undefined) {
    runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
    cachedTickContractPromise = import(pathToFileURL(TICK_MODULE_PATH).href);
  }

  return cachedTickContractPromise;
}

test('The cycle clearly says the rope-worldline is canonical, the AST worldline is derived, and Git commits are durable witnesses rather than the cadence of editor truth.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /The cycle clearly says the rope-worldline is canonical, the AST\s+worldline is derived, and Git commits are durable witnesses rather than the\s+cadence of editor truth\./,
  );
  assert.match(designDoc, /The rope-worldline is canonical\./);
  assert.match(designDoc, /The AST worldline is derived\./);
  assert.match(designDoc, /Git commits are durable witnesses, not the cadence of editor truth\./);
});

test('The cycle makes the hot / warm / cold ownership split explicit across jedit, Echo, Graft, and git-warp.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /The cycle makes the hot \/ warm \/ cold ownership split explicit across\s+`jedit`, Echo, Graft, and `git-warp`\./,
  );
  assert.match(designDoc, /### Hot runtime truths/);
  assert.match(designDoc, /### Warm projection truths/);
  assert.match(designDoc, /### Cold witness truths/);
  assert.match(designDoc, /### `jedit`/);
  assert.match(designDoc, /### Echo \/ `echo-text`/);
  assert.match(designDoc, /### Graft/);
  assert.match(designDoc, /### `git-warp`/);
});

test('The cycle explains save as a checkpoint rather than a reset.', () => {
  const designDoc = readDesignDoc();

  assert.match(designDoc, /The cycle explains save as a checkpoint rather than a reset\./);
  assert.match(designDoc, /Save is a checkpoint, not a reset\./);
  assert.match(designDoc, /Saving must not:\s+- destroy the hot rope-worldline/s);
});

test('The cycle names a tiered retention model for tick receipts, ticks, edit groups, and checkpoints/admissions.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /The cycle names a tiered retention model for tick receipts, ticks, edit\s+groups, and checkpoints\/admissions\./,
  );
  assert.match(designDoc, /- tick receipts/);
  assert.match(designDoc, /- ticks/);
  assert.match(designDoc, /- edit groups/);
  assert.match(designDoc, /- checkpoints and admissions/);
});

test('Save creates a checkpoint without changing the current root.', async () => {
  const contract = await loadContract();
  const state = contract.createSaveCheckpointState(7, 'notes/today.md', [3, 4, 5]);

  const result = contract.saveCheckpoint(state);

  assert.equal(result.nextState.currentRootId, 7);
  assert.deepEqual(result.nextState.checkpoints, [
    {
      id: 1,
      rootId: 7,
      path: 'notes/today.md',
    },
  ]);
});

test('Save preserves tick history rather than clearing it.', async () => {
  const contract = await loadContract();
  const state = contract.createSaveCheckpointState(7, 'notes/today.md', [11, 12, 13]);

  const result = contract.saveCheckpoint(state);

  assert.deepEqual(result.nextState.tickIds, [11, 12, 13]);
});

test('Saving the same head twice is a logical no-op.', async () => {
  const contract = await loadContract();
  const initial = contract.createSaveCheckpointState(9, 'src/main.ts', [21]);
  const firstSave = contract.saveCheckpoint(initial);
  const secondSave = contract.saveCheckpoint(firstSave.nextState);

  assert.equal(secondSave.nextState, firstSave.nextState);
  assert.equal(secondSave.receipt, undefined);
});

test('Admitting a ReplaceRange mints a tick and advances the current root.', async () => {
  const contract = await loadTickContract();
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const state = contract.createTickAdmissionState(text.createBufferRoot('hello world'));

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(5, 5),
    text.createTextFragment(' brave new'),
  );

  assert.equal(text.materializeRoot(result.nextState.currentRoot), 'hello brave new world');
  assert.equal(result.receipt?.tickId, 1);
  assert.deepEqual(result.nextState.ticks, [
    {
      id: 1,
      rootId: result.nextState.currentRoot.id,
    },
  ]);
});

test('Tick admission carries the ReplaceRange receipt as its causal witness.', async () => {
  const contract = await loadTickContract();
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const initialRoot = text.createBufferRoot('hello world');
  const fragment = text.createTextFragment(' brave new');
  const state = contract.createTickAdmissionState(initialRoot);

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(5, 5),
    fragment,
  );

  assert.equal(result.receipt?.replaceReceipt.baseRootId, initialRoot.id);
  assert.equal(result.receipt?.replaceReceipt.nextRootId, result.nextState.currentRoot.id);
  assert.equal(result.receipt?.replaceReceipt.insertedRootId, fragment.root.id);
});

test('A logical no-op does not mint a tick.', async () => {
  const contract = await loadTickContract();
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const state = contract.createTickAdmissionState(text.createBufferRoot('hello'));

  const result = contract.admitReplaceRangeTick(
    state,
    text.createTextRange(0, 5),
    text.createTextFragment('hello'),
  );

  assert.equal(result.nextState, state);
  assert.equal(result.receipt, undefined);
});

test('The runtime contract stays a minimal save-checkpoint seam rather than a full rope runtime.', async () => {
  const contract = await loadContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_RUNTIME_EXPORTS);
});

test('The runtime contract stays a minimal tick-admission seam rather than a full rope runtime.', async () => {
  const contract = await loadTickContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_TICK_RUNTIME_EXPORTS);
});

test('The workspace satisfies build, quality, and the save/tick contract suites.', () => {
  runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
  runCommand(['--test', CONTRACT_SPEC_PATH]);
  runCommand(['--test', TICK_CONTRACT_SPEC_PATH]);
  runCommand([QUALITY_GATE_PATH, '--json']);
});
