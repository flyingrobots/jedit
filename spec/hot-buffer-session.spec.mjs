import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const APP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'hot-buffer-session.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const TEXT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js');

async function loadModules() {
  await ensureDistBuilt();

  const [app, adapter, text] = await Promise.all([
    import(pathToFileURL(APP_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(TEXT_MODULE_PATH).href),
  ]);

  return { app, adapter, text };
}

test('Applying edits inside an open group auto-includes admitted ticks in that group.', async () => {
  const { app, adapter, text } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const opened = app.beginEditGroup(
    runtime,
    app.startHotBufferSession(runtime, 'notes/today.md', 'hello world'),
  );

  const first = app.applyBufferEdit(
    runtime,
    opened,
    text.createTextRange(5, 5),
    ' brave',
  );
  const second = app.applyBufferEdit(
    runtime,
    first.nextState,
    text.createTextRange(11, 11),
    ' new',
  );
  const closed = app.endEditGroup(runtime, second.nextState);

  assert.equal(app.materializeHotBuffer(runtime, second.nextState), 'hello brave new world');
  assert.deepEqual(closed.nextState.editGroups, [
    {
      id: 1,
      tickIds: [1, 2],
    },
  ]);
  assert.deepEqual(closed.receipt, {
    groupId: 1,
    tickIds: [1, 2],
  });
});

test('A logical no-op edit does not mint a tick or change open-group membership.', async () => {
  const { app, adapter, text } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const opened = app.beginEditGroup(
    runtime,
    app.startHotBufferSession(runtime, 'notes/today.md', 'hello'),
  );

  const result = app.applyBufferEdit(
    runtime,
    opened,
    text.createTextRange(0, 5),
    'hello',
  );

  assert.equal(result.tickId, undefined);
  assert.deepEqual(result.nextState.ticks, []);
  assert.deepEqual(result.nextState.openEditGroup?.tickIds, []);
});

test('Saving preserves tick and edit-group history while adding a checkpoint.', async () => {
  const { app, adapter, text } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const opened = app.beginEditGroup(
    runtime,
    app.startHotBufferSession(runtime, 'notes/today.md', 'hello'),
  );
  const edited = app.applyBufferEdit(
    runtime,
    opened,
    text.createTextRange(5, 5),
    ' world',
  );
  const closed = app.endEditGroup(runtime, edited.nextState);

  const saved = app.saveHotBuffer(runtime, closed.nextState);

  assert.deepEqual(saved.nextState.ticks, [
    {
      id: 1,
      rootId: edited.nextState.currentRoot.id,
    },
  ]);
  assert.deepEqual(saved.nextState.editGroups, [
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
  assert.equal(saved.receipt?.checkpointId, 1);
});
