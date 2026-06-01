import assert from 'node:assert/strict';
import test from 'node:test';
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
  await harness.run(saveCommands[0]);
  await harness.run(saveCommands[1]);

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
