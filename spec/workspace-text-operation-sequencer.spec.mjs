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
  const filePath = '/repo/notes.md';
  const bufferId = 'buffer:notes';

  const first = sequencer.sequenceEdit(session, filePath, bufferId, async () => {
    calls.push('first');
    return {
      kind: resultsModule.WorkspaceTextResultKinds.Obstructed,
      filePath,
      issue,
    };
  });
  const second = sequencer.sequenceEdit(session, filePath, bufferId, async () => {
    calls.push('second');
    return appliedResult(resultsModule, filePath, bufferId, 'receipt:second');
  });

  assert.equal((await first).kind, resultsModule.WorkspaceTextResultKinds.Obstructed);
  const secondResult = await second;

  assert.deepEqual(calls, ['first']);
  assert.equal(secondResult.kind, resultsModule.WorkspaceTextResultKinds.Obstructed);
  assert.equal(secondResult.filePath, filePath);
  assert.equal(secondResult.issue, issue);
});

test('workspace text operation sequencer does not coalesce exports after newer queued edits', async () => {
  const [sequencerModule, resultsModule] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-operation-sequencer.js'),
    importDist('app', 'workspace', 'workspace-text-results.js'),
  ]);
  const sequencer = sequencerModule.createWorkspaceTextOperationSequencer();
  const session = {};
  const calls = [];
  const firstEditGate = deferred();
  const filePath = '/repo/notes.md';
  const bufferId = 'buffer:notes';

  const firstEdit = sequencer.sequenceEdit(session, filePath, bufferId, async () => {
    calls.push('edit:first');
    await firstEditGate.promise;
    return appliedResult(resultsModule, filePath, bufferId, 'receipt:first');
  });
  const firstExport = sequencer.sequenceExport(session, filePath, bufferId, async () => {
    calls.push('export:first');
    return exportedResult(resultsModule, filePath, bufferId, 'reading:first');
  });
  const secondEdit = sequencer.sequenceEdit(session, filePath, bufferId, async () => {
    calls.push('edit:second');
    return appliedResult(resultsModule, filePath, bufferId, 'receipt:second');
  });
  const secondExport = sequencer.sequenceExport(session, filePath, bufferId, async () => {
    calls.push('export:second');
    return exportedResult(resultsModule, filePath, bufferId, 'reading:second');
  });

  await waitForCalls(calls, 1);
  assert.deepEqual(calls, ['edit:first']);
  firstEditGate.resolve();
  const [, firstExportResult, , secondExportResult] = await Promise.all([
    firstEdit,
    firstExport,
    secondEdit,
    secondExport,
  ]);

  assert.deepEqual(calls, ['edit:first', 'export:first', 'edit:second', 'export:second']);
  assert.equal(firstExportResult.readingId, 'reading:first');
  assert.equal(secondExportResult.readingId, 'reading:second');
});

test('workspace text operation sequencer scopes obstructions to the obstructed buffer', async () => {
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

  const alphaEdit = sequencer.sequenceEdit(session, '/repo/alpha.md', 'buffer:alpha', async () => {
    calls.push('alpha:edit');
    return {
      kind: resultsModule.WorkspaceTextResultKinds.Obstructed,
      filePath: '/repo/alpha.md',
      issue,
    };
  });
  const betaExport = sequencer.sequenceExport(session, '/repo/beta.md', 'buffer:beta', async () => {
    calls.push('beta:export');
    return exportedResult(resultsModule, '/repo/beta.md', 'buffer:beta', 'reading:beta');
  });

  assert.equal((await alphaEdit).kind, resultsModule.WorkspaceTextResultKinds.Obstructed);
  const betaExportResult = await betaExport;

  assert.deepEqual(calls, ['alpha:edit', 'beta:export']);
  assert.equal(betaExportResult.kind, resultsModule.WorkspaceTextResultKinds.Exported);
  assert.equal(betaExportResult.readingId, 'reading:beta');
});

function appliedResult(resultsModule, filePath, bufferId, receiptId) {
  return {
    kind: resultsModule.WorkspaceTextResultKinds.Applied,
    filePath,
    bufferId,
    receiptId,
    cache: {},
  };
}

function exportedResult(resultsModule, filePath, bufferId, readingId) {
  return {
    kind: resultsModule.WorkspaceTextResultKinds.Exported,
    filePath,
    bufferId,
    readingId,
    hostFingerprint: {
      kind: 'missing',
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitForCalls(calls, count) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (calls.length >= count) {
      return;
    }
    await Promise.resolve();
  }
  assert.equal(calls.length, count);
}
