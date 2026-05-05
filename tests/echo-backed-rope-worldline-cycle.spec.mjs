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
const EDIT_GROUP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'edit-group-contract.js');
const HOT_SESSION_APP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'hot-buffer-session.js');
const CONTRACT_SPEC_PATH = path.join('spec', 'save-checkpoint.contract.spec.mjs');
const TICK_CONTRACT_SPEC_PATH = path.join('spec', 'tick-admission.contract.spec.mjs');
const EDIT_GROUP_CONTRACT_SPEC_PATH = path.join('spec', 'edit-group.contract.spec.mjs');
const HOT_SESSION_CONTRACT_SPEC_PATH = path.join('spec', 'hot-buffer-session.spec.mjs');
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
const EXPECTED_EDIT_GROUP_RUNTIME_EXPORTS = [
  'EditGroupContractError',
  'closeEditGroup',
  'createEditGroupState',
  'includeTickInOpenGroup',
  'openEditGroup',
  'registerTick',
];
const EXPECTED_HOT_SESSION_APP_EXPORTS = [
  'applyBufferEdit',
  'beginEditGroup',
  'endEditGroup',
  'materializeHotBuffer',
  'saveHotBuffer',
  'startHotBufferSession',
];

let cachedContractPromise;
let cachedTickContractPromise;
let cachedEditGroupContractPromise;
let cachedHotSessionAppPromise;

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

async function loadEditGroupContract() {
  if (cachedEditGroupContractPromise === undefined) {
    runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
    cachedEditGroupContractPromise = import(pathToFileURL(EDIT_GROUP_MODULE_PATH).href);
  }

  return cachedEditGroupContractPromise;
}

async function loadHotSessionApp() {
  if (cachedHotSessionAppPromise === undefined) {
    runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
    cachedHotSessionAppPromise = import(pathToFileURL(HOT_SESSION_APP_MODULE_PATH).href);
  }

  return cachedHotSessionAppPromise;
}

test('The cycle clearly says witnessed causal history is canonical and Git commits are ecosystem exports.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /The cycle clearly says witnessed causal history is canonical, AST\s+structure is derived, and Git commits are ecosystem exports rather than the\s+cadence of editor truth\./,
  );
  assert.match(designDoc, /Witnessed causal history is canonical\./);
  assert.match(designDoc, /AST, file, pane, and diff shapes are readings or\s+materialized projections/);
  assert.match(designDoc, /Git commits are ecosystem exports, not the cadence or authority of editor\s+truth\./);
});

test('The cycle makes the causal history, reading, and projection split explicit.', () => {
  const designDoc = readDesignDoc();

  assert.match(
    designDoc,
    /The cycle makes the causal-history \/ reading \/ projection ownership split\s+explicit across `jedit`, Echo, Graft, filesystem, and Git adapters\./,
  );
  assert.match(designDoc, /### Causal history truths/);
  assert.match(designDoc, /### Reading truths/);
  assert.match(designDoc, /### Projection and export truths/);
  assert.match(designDoc, /### `jedit`/);
  assert.match(designDoc, /### Echo \/ `echo-text`/);
  assert.match(designDoc, /### Graft/);
  assert.match(designDoc, /### Filesystem and Git adapters/);
});

test('The cycle explains save as a checkpoint rather than a reset.', () => {
  const designDoc = readDesignDoc();

  assert.match(designDoc, /The cycle explains save as a checkpoint rather than a reset\./);
  assert.match(designDoc, /Save is a checkpoint, not a reset\./);
  assert.match(designDoc, /Saving must not:\s+- destroy causal history/s);
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

test('An edit group can close over multiple known ticks.', async () => {
  const contract = await loadEditGroupContract();
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
  const contract = await loadEditGroupContract();
  const state = contract.openEditGroup(contract.createEditGroupState([1, 2]));

  assert.throws(
    () => contract.includeTickInOpenGroup(state, 3),
    (error) => error instanceof contract.EditGroupContractError && error.code === 2,
  );
});

test('Closing an empty open group is a logical no-op.', async () => {
  const contract = await loadEditGroupContract();
  const state = contract.openEditGroup(contract.createEditGroupState([1, 2]));

  const result = contract.closeEditGroup(state);

  assert.deepEqual(result.nextState.groups, []);
  assert.equal(result.nextState.openGroup, undefined);
  assert.equal(result.receipt, undefined);
});

test('The app-facing causal session composes tick admission, edit grouping, and checkpointing without redefining ticks.', async () => {
  const app = await loadHotSessionApp();
  const adapter = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js')).href);
  const text = await import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js')).href);
  const runtime = adapter.createInMemoryHotTextRuntime();

  const opened = app.beginEditGroup(
    runtime,
    app.startHotBufferSession(runtime, 'notes/today.md', 'hello world'),
  );
  const edited = app.applyBufferEdit(
    runtime,
    opened,
    text.createTextRange(5, 5),
    ' brave new',
  );
  const closed = app.endEditGroup(runtime, edited.nextState);
  const saved = app.saveHotBuffer(runtime, closed.nextState);

  assert.equal(app.materializeHotBuffer(runtime, edited.nextState), 'hello brave new world');
  assert.deepEqual(closed.nextState.editGroups, [
    {
      id: 1,
      tickIds: [1],
    },
  ]);
  assert.deepEqual(saved.nextState.checkpoints, [
    {
      id: 1,
      rootId: edited.nextState.currentRoot.id,
      path: 'notes/today.md',
    },
  ]);
});

test('The runtime contract stays a minimal save-checkpoint seam rather than a full rope runtime.', async () => {
  const contract = await loadContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_RUNTIME_EXPORTS);
});

test('The runtime contract stays a minimal tick-admission seam rather than a full rope runtime.', async () => {
  const contract = await loadTickContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_TICK_RUNTIME_EXPORTS);
});

test('The runtime contract stays a minimal edit-group seam rather than a full rope runtime.', async () => {
  const contract = await loadEditGroupContract();

  assert.deepEqual(Object.keys(contract).sort(), EXPECTED_EDIT_GROUP_RUNTIME_EXPORTS);
});

test('The app-facing causal session seam stays minimal.', async () => {
  const app = await loadHotSessionApp();

  assert.deepEqual(Object.keys(app).sort(), EXPECTED_HOT_SESSION_APP_EXPORTS);
});

test('The workspace satisfies build, quality, and the save/tick/edit-group/app contract suites.', () => {
  runCommand([TYPESCRIPT_CLI_PATH, '-p', 'tsconfig.json']);
  runCommand(['--test', CONTRACT_SPEC_PATH]);
  runCommand(['--test', TICK_CONTRACT_SPEC_PATH]);
  runCommand(['--test', EDIT_GROUP_CONTRACT_SPEC_PATH]);
  runCommand(['--test', HOT_SESSION_CONTRACT_SPEC_PATH]);
  runCommand([QUALITY_GATE_PATH, '--json']);
});
