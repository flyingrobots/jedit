import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';
import { importDist } from './workspace-helpers.mjs';

async function openedHarness(options = {}) {
  const harness = await createWorkspaceEchoAppHarness({
    readings: ['before edit', 'after edit'],
    ...options,
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    focusPane: 'editor',
    fileDrawerOpen: false,
  });
  return harness;
}

function lastCommandEvent(model) {
  const authority = model.textAuthority;
  return authority.pendingCommandEvent?.event ?? authority.lastCommandEvent;
}

test('undo is named as a history reversal in command provenance', async () => {
  const harness = await openedHarness({
    hostLines: ['abc'],
    readings: ['abc', 'bc', 'abc'],
  });

  await harness.runFirst(await harness.key('x'));
  await harness.runFirst(await harness.key('u'));

  const event = lastCommandEvent(harness.model);
  assert.equal(event?.family, 'history');
  assert.equal(event?.command, 'u');
  assert.match(event?.summary ?? '', /undo/);
});

test('settled undo events keep history identity, receipt truth, and a reversal reference', async () => {
  const harness = await openedHarness({
    hostLines: ['abc'],
    readings: ['abc', 'bc', 'abc'],
  });

  await harness.runFirst(await harness.key('x'));
  await harness.runFirst(await harness.key('u'));

  const event = lastCommandEvent(harness.model);
  assert.equal(event?.eventId.startsWith('history:undo:'), true);
  assert.equal(event?.receipt.posture, 'received');
  assert.equal(event?.summary.includes('receipt pending'), false);
  assert.match(event?.summary ?? '', /reverses receipt/);
  assert.equal(typeof event?.reversedReceiptId, 'string');
});

test('shift+U is never classified as a history key', async () => {
  const history = await importDist('app', 'workspace', 'workspace-history-commands.js');
  const authority = await importDist('app', 'workspace', 'workspace-text-authority.js');

  const kind = history.pendingCommandKindForNormalModeKey({
    key: 'u',
    shift: true,
    ctrl: false,
    alt: false,
  });

  assert.equal(kind, authority.WorkspaceTextPendingCommandKinds.Vim);
});

test('redo is named as a history reversal in command provenance', async () => {
  const harness = await openedHarness({
    hostLines: ['abc'],
    readings: ['abc', 'bc', 'abc', 'bc'],
  });

  await harness.runFirst(await harness.key('x'));
  await harness.runFirst(await harness.key('u'));
  await harness.runFirst(await harness.key('r', { ctrl: true }));

  const event = lastCommandEvent(harness.model);
  assert.equal(event?.family, 'history');
  assert.match(event?.summary ?? '', /redo/);
});

test('undo settlements carry the history provenance kind', async () => {
  const settlement = await importDist('app', 'workspace', 'workspace-text-wsc-settlement.js');
  const cache = {
    bufferId: 'buffer:notes',
    readingId: 'reading:notes',
    lines: ['abc'],
    coverage: 'full',
    lineCount: 1,
    startLine: 0,
    returnedLineCount: 1,
    totalLineCount: 1,
    hasMoreBefore: false,
    hasMoreAfter: false,
    cursorLine: 0,
    viewportLineCount: 24,
    truncated: false,
  };
  const request = {
    requestId: 7,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    kind: 'replace',
    startByte: 0,
    endByte: 1,
    insertText: 'a',
    atMs: 0,
    provenanceKind: 'undo',
  };

  const envelope = settlement.createWorkspaceTextEditSettlementEnvelope(request, 'receipt:9', cache);
  const payload = JSON.parse(new TextDecoder().decode(envelope.bytes));

  assert.equal(payload.provenanceKind, 'undo');
});

test('ordinary edit settlements omit the provenance kind field', async () => {
  const settlement = await importDist('app', 'workspace', 'workspace-text-wsc-settlement.js');
  const cache = {
    bufferId: 'buffer:notes',
    readingId: 'reading:notes',
    lines: ['abc'],
    coverage: 'full',
    lineCount: 1,
    startLine: 0,
    returnedLineCount: 1,
    totalLineCount: 1,
    hasMoreBefore: false,
    hasMoreAfter: false,
    cursorLine: 0,
    viewportLineCount: 24,
    truncated: false,
  };
  const request = {
    requestId: 8,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    kind: 'insert',
    startByte: 0,
    insertText: 'x',
    atMs: 0,
  };

  const envelope = settlement.createWorkspaceTextEditSettlementEnvelope(request, 'receipt:10', cache);
  const payload = JSON.parse(new TextDecoder().decode(envelope.bytes));

  assert.equal('provenanceKind' in payload, false);
});
