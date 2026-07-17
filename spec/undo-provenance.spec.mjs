import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function openedHarness() {
  const harness = await createWorkspaceEchoAppHarness({
    hostLines: ['abc'],
    readings: ['abc'],
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    focusPane: 'editor',
    fileDrawerOpen: false,
  });
  return harness;
}

test('production undo stays unavailable until Echo exposes an installed inverse operation', async () => {
  const harness = await openedHarness();
  const before = harness.model.editor?.lines;

  const commands = await harness.key('u');

  assert.deepEqual(commands, []);
  assert.deepEqual(harness.model.editor?.lines, before);
  assert.equal(harness.calls.replace.length, 0);
});

test('production redo stays unavailable until Echo exposes an installed inverse operation', async () => {
  const harness = await openedHarness();
  const before = harness.model.editor?.lines;

  const commands = await harness.key('r', { ctrl: true });

  assert.deepEqual(commands, []);
  assert.deepEqual(harness.model.editor?.lines, before);
  assert.equal(harness.calls.replace.length, 0);
});

test('production has no process-local text operation scheduler', async () => {
  await assert.rejects(
    readFile(path.join(REPO_ROOT, 'src', 'app', 'workspace', 'workspace-text-operation-sequencer.ts'), 'utf8'),
    { code: 'ENOENT' },
  );
});
