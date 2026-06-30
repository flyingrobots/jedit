import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importDist } from './dist-helpers.mjs';

test('workspace text operation sequencer does not run queued edits after obstruction', async () => {
  const [sequencerModule, resultsModule] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-operation-sequencer.js'),
    importDist('app', 'workspace', 'workspace-text-results.js'),
  ]);
  const sequencer = sequencerModule.createWorkspaceTextOperationSequencer();
  const session = {};
  const calls = [];
  const issue = {
    message: 'basis changed',
    level: 'error',
    source: 'command',
    atMs: 1,
  };

  const first = sequencer.sequenceEdit(session, async () => {
    calls.push('first');
    return {
      kind: resultsModule.WorkspaceTextResultKinds.Obstructed,
      filePath: '/repo/notes.md',
      issue,
    };
  });
  const second = sequencer.sequenceEdit(session, async () => {
    calls.push('second');
    return {
      kind: resultsModule.WorkspaceTextResultKinds.Applied,
      filePath: '/repo/notes.md',
      bufferId: 'buffer:notes',
      receiptId: 'receipt:second',
      cache: {},
    };
  });

  assert.equal((await first).kind, resultsModule.WorkspaceTextResultKinds.Obstructed);
  const secondResult = await second;

  assert.deepEqual(calls, ['first']);
  assert.equal(secondResult.kind, resultsModule.WorkspaceTextResultKinds.Obstructed);
  assert.equal(secondResult.filePath, '/repo/notes.md');
  assert.equal(secondResult.issue, issue);
});
