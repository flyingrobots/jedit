import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';

const GATE_OPEN_EDIT_SAVE_DISK = 'open-edit-save-disk';
const GATE_QUIT_CONFIRMATION = 'quit-confirmation';
const GATE_DIRTY_QUIT_GUARD = 'dirty-quit-guard';
const GATE_DIRTY_FILE_SWITCH_GUARD = 'dirty-file-switch-guard';
const GATE_SEARCH_ENTRY = 'slash-question-search-entry';
const GATE_SINGLE_BUFFER_POSTURE = 'single-buffer-posture';
const STATUS_PASSED = 'passed';
const STATUS_BLOCKED = 'blocked';
const STATUS_SCOPED = 'scoped';
const STATUS_READY = 'ready';
const SAVED_TEXT = 'saved from Echo';
const PASS_DIRTY_QUIT = 'Dirty quit uses a dirty-specific guardrail.';
const PASS_DIRTY_SWITCH =
  'Dirty file switches resolve unsaved changes before opening a replacement file.';
const PASS_SEARCH_ENTRY = 'Both / and ? search entry are product-complete.';
const PASS_MULTI_BUFFER =
  'Multi-buffer behavior is supported and explicitly claimed.';
const BLOCK_OPEN_EDIT_SAVE =
  'Open, edit, save, or disk output is not routed through production text authority.';
const BLOCK_QUIT_CONFIRMATION =
  'Plain quit confirmation or explicit forced quit behavior is not available.';

test('editor trust preflight names current blockers from workspace behavior', async () => {
  const preflight = await importDist('app', 'workspace', 'editor-trust-preflight.js');
  const observation = {
    ...(await observeOpenEditSaveAndQuit()),
    dirtyFileSwitchBlocked: await observeDirtyFileSwitchBlocked(),
    ...(await observeSearchEntry()),
    hasMultipleOpenBuffers: false,
  };

  const report = preflight.createEditorTrustPreflightReport(observation);

  assert.equal(report.schema, 'jedit.editor-trust-preflight.v1');
  assert.equal(report.cycle, 'WF-0108');
  assert.equal(report.slice, 0);
  assert.equal(report.status, 'blocked');
  assertGate(report, GATE_OPEN_EDIT_SAVE_DISK, STATUS_PASSED);
  assertGate(report, GATE_QUIT_CONFIRMATION, STATUS_PASSED);
  assertGate(report, GATE_DIRTY_QUIT_GUARD, STATUS_BLOCKED);
  assertGate(report, GATE_DIRTY_FILE_SWITCH_GUARD, STATUS_BLOCKED);
  assertGate(report, GATE_SEARCH_ENTRY, STATUS_BLOCKED);
  assertGate(report, GATE_SINGLE_BUFFER_POSTURE, STATUS_SCOPED);
  assert.deepEqual(report.blockers.map((gate) => gate.id), [
    GATE_DIRTY_QUIT_GUARD,
    GATE_DIRTY_FILE_SWITCH_GUARD,
    GATE_SEARCH_ENTRY,
  ]);
});

test('editor trust preflight current report stays aligned with Slice 0 findings', async () => {
  const [preflight, runtimeProbe] = await Promise.all([
    importDist('app', 'workspace', 'editor-trust-preflight.js'),
    importDist('app', 'workspace', 'editor-trust-preflight-runtime-probe.js'),
  ]);
  const reporter = preflight.createEditorTrustPreflightReporter(
    runtimeProbe.createEditorTrustPreflightRuntimeProbe(),
  );
  const report = await reporter.currentReport();

  assert.equal(report.status, 'blocked');
  assert.deepEqual(report.blockers.map((gate) => gate.id), [
    GATE_DIRTY_QUIT_GUARD,
    GATE_DIRTY_FILE_SWITCH_GUARD,
    GATE_SEARCH_ENTRY,
  ]);
});

test('editor trust preflight gives regressed pass gates blocker text', async () => {
  const preflight = await importDist('app', 'workspace', 'editor-trust-preflight.js');
  const report = preflight.createEditorTrustPreflightReport({
    ...passingObservation(),
    openUsesProductionAuthority: false,
    quitRequiresConfirmation: false,
  });

  const openGate = assertGate(report, GATE_OPEN_EDIT_SAVE_DISK, STATUS_BLOCKED);
  const quitGate = assertGate(report, GATE_QUIT_CONFIRMATION, STATUS_BLOCKED);

  assert.equal(openGate.summary, BLOCK_OPEN_EDIT_SAVE);
  assert.equal(openGate.blocker, BLOCK_OPEN_EDIT_SAVE);
  assert.equal(quitGate.summary, BLOCK_QUIT_CONFIRMATION);
  assert.equal(quitGate.blocker, BLOCK_QUIT_CONFIRMATION);
  assert.deepEqual(report.blockers.map((gate) => gate.id), [
    GATE_OPEN_EDIT_SAVE_DISK,
    GATE_QUIT_CONFIRMATION,
  ]);
});

test('editor trust preflight uses status-aware summaries for passing gates', async () => {
  const preflight = await importDist('app', 'workspace', 'editor-trust-preflight.js');
  const report = preflight.createEditorTrustPreflightReport(passingObservation());

  assert.equal(report.status, STATUS_READY);
  assert.equal(assertGate(report, GATE_DIRTY_QUIT_GUARD, STATUS_PASSED).summary, PASS_DIRTY_QUIT);
  assert.equal(assertGate(report, GATE_DIRTY_FILE_SWITCH_GUARD, STATUS_PASSED).summary, PASS_DIRTY_SWITCH);
  assert.equal(assertGate(report, GATE_SEARCH_ENTRY, STATUS_PASSED).summary, PASS_SEARCH_ENTRY);
  assert.equal(assertGate(report, GATE_SINGLE_BUFFER_POSTURE, STATUS_PASSED).summary, PASS_MULTI_BUFFER);
  assert.deepEqual(report.blockers, []);
});

async function observeOpenEditSaveAndQuit() {
  const harness = await createWorkspaceEchoAppHarness({
    readings: ['before edit', 'after edit'],
    exportText: SAVED_TEXT,
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    focusPane: 'editor',
    fileDrawerOpen: false,
  });
  await harness.key('i');
  await harness.runFirst(await harness.key('X', { shift: true }));
  await harness.key('escape');
  const dirtyModel = harness.model;
  const quitCommands = await harness.key('q');
  const quitRequiresConfirmation = harness.model.quitConfirmOpen && quitCommands.length === 0;
  harness.setModel({
    ...dirtyModel,
    commandLine: activeCommandLine('q!'),
  });
  const forceQuitCommands = await harness.key('enter');
  const forceQuitAvailable = !harness.model.quitConfirmOpen && forceQuitCommands.length === 1;
  harness.setModel(dirtyModel);
  const saveCommands = await harness.key('s', { ctrl: true });
  await harness.run(saveCommands[0]);
  await harness.run(saveCommands[1]);

  return {
    openUsesProductionAuthority: harness.calls.open.length === 1,
    editUsesProductionAuthority: harness.calls.insert.length === 1,
    saveExportsProductionText: harness.calls.export.length === 1 && harness.calls.checkpoint.length === 1,
    diskOutputVerified: savedText(harness) === SAVED_TEXT,
    quitRequiresConfirmation,
    forceQuitAvailable,
    dirtyStateTracked: dirtyModel.textAuthority.dirty === true && dirtyModel.editor.dirty === true,
    dirtyQuitHasDirtySpecificGuard: false,
  };
}

async function observeDirtyFileSwitchBlocked() {
  const firstPath = '/repo/notes.md';
  const secondPath = '/repo/other.md';
  const harness = await createWorkspaceEchoAppHarness({
    entries: [
      { kind: 'file', name: 'notes.md', path: firstPath },
      { kind: 'file', name: 'other.md', path: secondPath },
    ],
    hostLinesByPath: new Map([
      [firstPath, ['first']],
      [secondPath, ['second']],
    ]),
    bufferIdByKey: new Map([
      [firstPath, 'buffer:first'],
      [secondPath, 'buffer:second'],
    ]),
    readings: ['first', 'dirty first', 'second'],
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    focusPane: 'editor',
    fileDrawerOpen: false,
  });
  await harness.key('i');
  await harness.runFirst(await harness.key('X', { shift: true }));
  harness.setModel({
    ...harness.model,
    focusPane: 'files',
    fileDrawerOpen: true,
    selectedIndex: 1,
  });

  await harness.key('enter');

  return !(
    harness.model.textAuthority.kind === 'pending-open' &&
    harness.model.textAuthority.filePath === secondPath
  );
}

async function observeSearchEntry() {
  const slashHarness = await openedEditorHarness();
  await slashHarness.key('/');
  const questionHarness = await openedEditorHarness();
  await questionHarness.key('?');

  return {
    slashSearchEntryAvailable: searchEntryAvailable(slashHarness.model),
    questionSearchEntryAvailable: searchEntryAvailable(questionHarness.model),
  };
}

async function openedEditorHarness() {
  const harness = await createWorkspaceEchoAppHarness({
    readings: ['alpha beta alpha'],
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    focusPane: 'editor',
    fileDrawerOpen: false,
  });
  return harness;
}

function searchEntryAvailable(model) {
  return model.commandLine?.active === true || model.editor?.lastSearch?.pattern != null;
}

function savedText(harness) {
  return harness.savedFiles.map((file) => file.lines.join('\n')).join('\n');
}

function activeCommandLine(input) {
  return {
    active: true,
    input,
    cursorIndex: input.length,
    anchorCursorIndex: 0,
    selectedCompletionIndex: 0,
  };
}

function assertGate(report, id, status) {
  const gate = report.gates.find((candidate) => candidate.id === id);
  assert.ok(gate, `missing gate ${id}`);
  assert.equal(gate.status, status);
  return gate;
}

function passingObservation() {
  return {
    openUsesProductionAuthority: true,
    editUsesProductionAuthority: true,
    saveExportsProductionText: true,
    diskOutputVerified: true,
    quitRequiresConfirmation: true,
    forceQuitAvailable: true,
    dirtyStateTracked: true,
    dirtyQuitHasDirtySpecificGuard: true,
    dirtyFileSwitchBlocked: true,
    slashSearchEntryAvailable: true,
    questionSearchEntryAvailable: true,
    hasMultipleOpenBuffers: true,
  };
}
