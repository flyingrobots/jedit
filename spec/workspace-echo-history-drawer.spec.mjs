import assert from 'node:assert/strict';
import test from 'node:test';
import { createI18nMock } from './i18n-mock.mjs';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';
import { importDist, surfaceText } from './workspace-helpers.mjs';

test('Echo history drawer renders workspace-visible Echo evidence', async () => {
  const drawers = await importDist('app', 'workspace', 'viewer-drawers.js');
  const harness = await createWorkspaceEchoAppHarness({
    readings: ['before edit', 'after edit'],
    exportText: 'saved from Echo',
  });

  await harness.runFirst(await harness.key('enter'));
  await harness.key('i');
  await harness.runFirst(await harness.key('X', { shift: true }));
  const saveCommands = await harness.key('s', { ctrl: true });
  await harness.runAll(saveCommands);

  assert.deepEqual(harness.model.echoHistory.map((entry) => [entry.kind, entry.status, entry.evidenceId]), [
    ['open', 'opened', 'reading:1'],
    ['edit', 'applied', 'receipt:insert'],
    ['export', 'exported', 'reading:export'],
    ['checkpoint', 'checkpointed', 'checkpoint:save'],
  ]);
  assert.equal(harness.model.echoHistorySelectedIndex, 3);

  const rendered = surfaceText(drawers.renderDrawer('history', harness.model, 76, 8));
  assert.match(rendered, /Echo History/);
  assert.match(rendered, /receipt:insert/);
  assert.match(rendered, /checkpoint:save/);
});

test('Echo history edit rows include Vim command provenance when available', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    hostLines: ['alpha beta'],
    readings: ['alpha beta', 'beta'],
  });

  await harness.runFirst(await harness.key('enter'));
  await harness.key('d');
  await harness.runAll(await harness.key('w'));

  const edit = harness.model.echoHistory.find((entry) => entry.kind === 'edit');
  assert.ok(edit, 'expected an applied edit history row');
  assert.equal(edit.status, 'applied');
  assert.equal(edit.evidenceId, 'receipt:delete');
  assert.match(edit.summary, /\/repo\/notes\.md dw delete motion 0\.\.6 receipt receipt:delete/);
});

test('Echo history does not reuse stale Vim provenance for later insert edits', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    hostLines: ['alpha beta'],
    readings: ['alpha beta', 'beta', 'Xbeta'],
  });

  await harness.runFirst(await harness.key('enter'));
  await harness.key('d');
  await harness.runAll(await harness.key('w'));
  await harness.key('i');
  await harness.runAll(await harness.key('X', { shift: true }));

  const edits = harness.model.echoHistory.filter((entry) => entry.kind === 'edit');
  assert.equal(edits.length, 2);
  assert.match(edits[0].summary, /dw delete motion 0\.\.6 receipt receipt:delete/);
  assert.equal(edits[1].evidenceId, 'receipt:insert');
  assert.equal(edits[1].summary, '/repo/notes.md');
});

test('Echo history uses the planned command event when editor repeat state drifts before settlement', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    hostLines: ['alpha beta'],
    readings: ['alpha beta', 'beta'],
  });

  await harness.runFirst(await harness.key('enter'));
  await harness.key('d');
  const commands = await harness.key('w');
  const queued = harness.model;

  assert.equal(queued.textAuthority.pendingCommandEvent.requestId, queued.textRequestId);
  assert.equal(queued.textAuthority.pendingCommandEvent.event.command, 'dw');

  harness.setModel({
    ...queued,
    editor: {
      ...queued.editor,
      lastVimEdit: {
        keys: ['c', 'i', 'w'],
        description: 'operatorTextObject:change:',
        replayPolicy: 'resolve-current-basis',
        sourceBasisDigest: 'basis:stale',
        target: {
          basisDigest: 'basis:stale',
          rangeStart: 0,
          rangeEnd: 5,
          shape: 'charwise',
        },
      },
    },
  });
  await harness.runAll(commands);

  const edit = harness.model.echoHistory.find((entry) => entry.kind === 'edit');
  assert.ok(edit, 'expected an applied edit history row');
  assert.equal(edit.evidenceId, 'receipt:delete');
  assert.match(edit.summary, /\/repo\/notes\.md dw delete motion 0\.\.6 receipt receipt:delete/);
  assert.doesNotMatch(edit.summary, /ciw/);
  assert.equal(harness.model.textAuthority.lastCommandEvent.command, 'dw');
  assert.equal(harness.model.textAuthority.lastCommandEvent.requestId, queued.textRequestId);
  assert.equal(harness.model.textAuthority.lastCommandEvent.receiptId, 'receipt:delete');
});

test('ctrl-h focuses Echo history and j/k navigates its selected row', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    readings: ['before edit', 'after edit'],
  });

  await harness.runFirst(await harness.key('enter'));
  await harness.key('i');
  await harness.runFirst(await harness.key('X', { shift: true }));
  await harness.runFirst(await harness.key('s', { ctrl: true }));
  await harness.key('h', { ctrl: true });

  assert.equal(harness.model.historyDrawerOpen, true);
  assert.equal(harness.model.focusPane, 'history');

  const selected = harness.model.echoHistorySelectedIndex;
  await harness.key('k');
  assert.equal(harness.model.echoHistorySelectedIndex, selected - 1);
  await harness.key('j');
  assert.equal(harness.model.echoHistorySelectedIndex, selected);
});

test('Echo history keeps the appended entry selected after tick sorting', async () => {
  const history = await importDist('app', 'workspace', 'echo-history.js');
  let entries = [];
  entries = history.appendEchoHistoryEntry(entries, {
    kind: history.EchoHistoryEntryKinds.Open,
    status: history.EchoHistoryEntryStatuses.Opened,
    evidenceId: 'tick:10',
    summary: 'late',
  });
  entries = history.appendEchoHistoryEntry(entries, {
    kind: history.EchoHistoryEntryKinds.Edit,
    status: history.EchoHistoryEntryStatuses.Applied,
    evidenceId: 'tick:5',
    summary: 'early',
  });

  const selected = history.sortedEchoHistoryIndexForSequence(entries, entries.at(-1).sequence);
  const lines = history.renderEchoHistoryLines(entries, selected, 80, 5, createI18nMock());

  assert.equal(selected, 0);
  assert.match(lines.join('\n'), /›\s+2\s+5\s+edit\s+applied\s+tick:5\s+early/);
});

test('Echo history drawer obtains its chrome text from i18n', async () => {
  const history = await importDist('app', 'workspace', 'echo-history.js');
  const i18n = {
    t: (path) => `<${path}>`,
  };
  const empty = history.renderEchoHistoryLines([], 0, 60, 3, i18n).join('\n');
  const listed = history.renderEchoHistoryLines([
    {
      sequence: 1,
      tickId: 1,
      kind: history.EchoHistoryEntryKinds.Open,
      status: history.EchoHistoryEntryStatuses.Opened,
      evidenceId: 'tick:1',
      summary: 'opened',
    },
  ], 0, 60, 3, i18n).join('\n');

  assert.match(empty, /<history\.title>/);
  assert.match(empty, /<history\.empty>/);
  assert.match(listed, /<history\.header>/);
});
