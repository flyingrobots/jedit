import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceEchoAppHarness, productionTextObstruction } from './workspace-echo-app-harness.mjs';
import {
  byteOffsetAtLine,
  echoTextDocument,
  observedDocumentWindow,
  openFileDrawerIndex,
  openedHarness,
  twoFileHarness,
} from './workspace-echo-test-utils.mjs';

function byteOffset(value) {
  return { kind: 'utf8-byte-offset', value };
}

test('real workspace app path opens files through production text authority', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    hostLines: ['host-only text'],
    readings: ['Echo reading text'],
  });

  const commands = await harness.key('enter');
  await harness.runFirst(commands);

  assert.deepEqual(harness.calls.open, [{
    bufferKey: '/repo/notes.md',
    initialText: 'host-only text',
    projectionPath: '/repo/notes.md',
    atMs: 42,
  }]);
  assert.equal(harness.calls.observe.length, 1);
  assert.equal(harness.model.textAuthority.kind, 'opened');
  assert.equal(harness.model.textAuthority.cache.readingId, 'reading:1');
  assert.match(harness.renderText(), /Echo reading text/);
  assert.doesNotMatch(harness.renderText(), /host-only text/);
});

test('real workspace app path edits through production text session', async () => {
  const harness = await openedHarness();

  await harness.key('i');
  const commands = await harness.key('X', { shift: true });
  await harness.runFirst(commands);

  assert.deepEqual(harness.calls.insert, [{
    bufferId: 'buffer:notes',
    startByte: byteOffset(0),
    insertText: 'X',
    atMs: 0,
  }]);
  assert.equal(harness.model.textAuthority.lastReceiptId, 'receipt:insert');
  assert.match(harness.renderText(), /after edit/);
  assert.doesNotMatch(harness.renderText(), /before edit/);
});

test('real workspace app path advances insert cursor after each echoed character', async () => {
  const harness = await openedHarness({ readings: ['before edit', 'h', 'he', 'hel', 'hell', 'hello'] });

  await harness.key('i');
  for (const character of ['h', 'e', 'l', 'l', 'o']) {
    await harness.runFirst(await harness.key(character));
  }

  assert.deepEqual(harness.calls.insert.map((call) => ({
    startByte: call.startByte,
    insertText: call.insertText,
  })), [
    { startByte: byteOffset(0), insertText: 'h' },
    { startByte: byteOffset(1), insertText: 'e' },
    { startByte: byteOffset(2), insertText: 'l' },
    { startByte: byteOffset(3), insertText: 'l' },
    { startByte: byteOffset(4), insertText: 'o' },
  ]);
  assert.equal(harness.model.editor.cursorCol, 5);
  assert.match(harness.renderText(), /hello/);
  assert.doesNotMatch(harness.renderText(), /olleh/);
});

test('workspace refuses dependent inserts until Echo returns a new observed basis', async () => {
  const harness = await openedHarness({ readings: ['', 'h'] });

  await harness.key('i');
  const firstCommands = await harness.key('h');
  const dependentCommands = await harness.key('e');

  assert.equal(harness.calls.insert.length, 0);
  assert.equal(harness.model.editor.cursorCol, 0);
  assert.equal(harness.model.textAuthority.dirty, false);
  assert.equal(harness.model.textAuthority.pendingClientSeq, 2);
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'predicted');
  assert.deepEqual(dependentCommands, []);
  assert.doesNotMatch(harness.renderText(), /he/);

  await harness.runFirst(firstCommands);

  assert.equal(harness.model.editor.cursorCol, 1);
  assert.match(harness.renderText(), /h/);
  assert.deepEqual(harness.calls.insert, [{
    bufferId: 'buffer:notes',
    startByte: byteOffset(0),
    insertText: 'h',
    atMs: 0,
  }]);
});

test('workspace advances multiline text only through returned Echo observations', async () => {
  const document = echoTextDocument('');
  const calls = {
    insert: [],
    observe: [],
  };
  const productionTextSession = {
    openBuffer: async (request) => {
      document.replace(request.initialText);
      return {
        kind: 'opened',
        bufferId: 'buffer:notes',
      };
    },
    insertText: async (request) => {
      calls.insert.push(request);
      document.insert(request.startByte, request.insertText);
      return {
        kind: 'applied',
        result: {
          receiptId: `receipt:${calls.insert.length}`,
        },
      };
    },
    observeWindow: async (request) => {
      calls.observe.push(request);
      const lines = document.lines();
      const startLine = Math.max(0, request.aperture.cursorLine);
      const visibleLines = lines.slice(startLine, startLine + request.aperture.viewportLineCount);
      return {
        kind: 'observed',
        observed: {
          value: {
            readingId: `reading:${calls.observe.length}`,
            lines: visibleLines.map((text, index) => ({
              lineNumber: startLine + index,
              startByte: byteOffsetAtLine(lines, startLine + index),
              endByte: byteOffsetAtLine(lines, startLine + index) + text.length,
              text,
            })),
            startLine,
            lineCount: visibleLines.length,
            totalLineCount: lines.length,
            hasMoreBefore: startLine > 0,
            hasMoreAfter: startLine + visibleLines.length < lines.length,
            cursorLine: request.aperture.cursorLine,
            viewportLineCount: request.aperture.viewportLineCount,
            truncated: false,
          },
        },
      };
    },
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  for (let index = 0; index < 4; index += 1) {
    await harness.runAll(await harness.key('enter'));
  }
  await harness.runAll(await harness.key('Z', { shift: true }));

  assert.equal(harness.model.editor.cursorRow, 4);
  assert.equal(harness.model.editor.cursorCol, 1);
  assert.equal(harness.model.editor.lines.length, 5);
  assert.equal(harness.model.editor.lines[4], 'Z');
  assert.equal(harness.model.textAuthority.cache.coverage, 'full');
  assert.equal(harness.model.textAuthority.cache.truncated, false);
  assert.equal(calls.insert.length, 5);
  assert.deepEqual(calls.insert.at(-1), {
    bufferId: 'buffer:notes',
    startByte: byteOffset(4),
    insertText: 'Z',
    atMs: 0,
  });
});

test('workspace never renders an edit that Echo obstructs', async () => {
  const harness = await openedHarness({
    readings: [''],
    editObstruction: productionTextObstruction('footprint changed'),
  });

  await harness.key('i');
  const commands = await harness.key('X', { shift: true });
  assert.doesNotMatch(harness.renderText(), /X/);

  await harness.runFirst(commands);

  assert.doesNotMatch(harness.renderText(), /X/);
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'obstructed');
  assert.equal(harness.model.textAuthority.lastObstruction.message, 'footprint changed');
  assert.equal('echoHistory' in harness.model, false);
});

test('workspace buffer registry preserves dirty existing buffers across file switches', async () => {
  const harness = await twoFileHarness({
    hostLinesByPath: new Map([
      ['/repo/a.txt', ['']],
      ['/repo/b.txt', ['B']],
    ]),
    readings: ['', 'A', 'B'],
  });

  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    fileDrawerOpen: false,
    focusPane: 'editor',
  });
  await harness.key('i');
  await harness.runFirst(await harness.key('A', { shift: true }));
  await openFileDrawerIndex(harness, 1);
  await harness.runFirst(await harness.key('enter'));
  await openFileDrawerIndex(harness, 0);
  const reopenCommands = await harness.key('enter');

  assert.equal(reopenCommands.length, 0);
  assert.equal(harness.calls.open.length, 2);
  assert.equal(harness.model.editor.path, '/repo/a.txt');
  assert.equal(harness.model.editor.lines[0], 'A');
  assert.equal(harness.model.textAuthority.filePath, '/repo/a.txt');
  assert.equal(harness.model.textAuthority.dirty, true);
});

test('workspace buffer registry preserves missing-path unmaterialized buffers across file switches', async () => {
  const harness = await twoFileHarness({
    missingPaths: new Set(['/repo/a.txt']),
    hostLinesByPath: new Map([
      ['/repo/b.txt', ['B']],
    ]),
    readings: ['', 'M', 'B'],
  });

  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    fileDrawerOpen: false,
    focusPane: 'editor',
  });
  await harness.key('i');
  await harness.runFirst(await harness.key('M', { shift: true }));
  await openFileDrawerIndex(harness, 1);
  await harness.runFirst(await harness.key('enter'));
  await openFileDrawerIndex(harness, 0);
  await harness.key('enter');

  assert.equal(harness.savedFiles.length, 0);
  assert.equal(harness.model.editor.path, '/repo/a.txt');
  assert.equal(harness.model.editor.lines[0], 'M');
  assert.equal(harness.model.textAuthority.hostBasis, 'missing');
  assert.equal(harness.model.textAuthority.materialization, 'unmaterialized');
});

test('workspace buffer registry restores accepted Graft and highlight state per buffer', async () => {
  const sourceHighlight = {
    path: '/repo/a.txt',
    partial: false,
    spans: [],
  };
  const graftInfo = {
    path: '/repo/a.txt',
    relativePath: 'a.txt',
    dirty: false,
    projectionSource: 'saved-file',
    projectionPosture: 'current',
    outlineItems: [{
      kind: 'section',
      name: 'A',
      startLine: 1,
      endLine: 1,
    }],
    changeLines: [],
  };
  const harness = await twoFileHarness({
    hostLinesByPath: new Map([
      ['/repo/a.txt', ['A']],
      ['/repo/b.txt', ['B']],
    ]),
    readings: ['A', 'B'],
  });

  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    fileDrawerOpen: false,
    focusPane: 'editor',
    sourceHighlight,
    sourceHighlightLoading: true,
    graftInfo,
    graftLoading: true,
  });
  await harness.key('escape');
  await openFileDrawerIndex(harness, 1);
  await harness.runFirst(await harness.key('enter'));
  await openFileDrawerIndex(harness, 0);
  await harness.key('enter');

  assert.equal(harness.model.sourceHighlight, sourceHighlight);
  assert.equal(harness.model.sourceHighlightLoading, false);
  assert.equal(harness.model.graftInfo, graftInfo);
  assert.equal(harness.model.graftLoading, false);
});

test('edit command for the active buffer reuses the registry record', async () => {
  const harness = await twoFileHarness({
    hostLinesByPath: new Map([
      ['/repo/a.txt', ['A']],
      ['/repo/b.txt', ['B']],
    ]),
    readings: ['A'],
  });

  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    fileDrawerOpen: false,
    focusPane: 'editor',
    commandLine: {
      ...harness.model.commandLine,
      active: true,
      input: 'edit a.txt',
      cursorIndex: 'edit a.txt'.length,
      selectedCompletionIndex: 0,
    },
  });
  const commands = await harness.key('enter');

  assert.equal(commands.length, 0);
  assert.equal(harness.calls.open.length, 1);
  assert.equal(harness.model.editor.path, '/repo/a.txt');
});

test('real workspace app path inserts canonical spacebar token in insert mode', async () => {
  const harness = await openedHarness({ readings: ['before edit', 'h', 'hi', 'hi ', 'hi x'] });

  await harness.key('i');
  for (const key of ['h', 'i', 'space', 'x']) {
    await harness.runFirst(await harness.key(key));
  }

  assert.deepEqual(harness.calls.insert.map((call) => ({
    startByte: call.startByte,
    insertText: call.insertText,
  })), [
    { startByte: byteOffset(0), insertText: 'h' },
    { startByte: byteOffset(1), insertText: 'i' },
    { startByte: byteOffset(2), insertText: ' ' },
    { startByte: byteOffset(3), insertText: 'x' },
  ]);
  assert.equal(harness.model.editor.cursorCol, 4);
  assert.match(harness.renderText(), /hi x/);
});

test('real workspace app path saves by exporting and checkpointing production text', async () => {
  const harness = await openedHarness({ exportText: 'saved from Echo' });

  await harness.key('i');
  await harness.runFirst(await harness.key('X', { shift: true }));
  const saveCommands = await harness.key('s', { ctrl: true });
  await harness.runAll(saveCommands);

  assert.deepEqual(harness.savedFiles, [{ filePath: '/repo/notes.md', lines: ['saved from Echo'] }]);
  assert.equal(harness.calls.export.length, 1);
  assert.equal(harness.calls.checkpoint.length, 1);
  assert.equal(harness.model.textAuthority.lastExportReadingId, 'reading:export');
  assert.equal(harness.model.textAuthority.lastCheckpointId, 'checkpoint:save');
});

test('real workspace app path keeps obstruction honest without retrying', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    openObstruction: productionTextObstruction('open blocked'),
  });

  const commands = await harness.key('enter');
  await harness.runFirst(commands);

  assert.equal(harness.calls.open.length, 1);
  assert.equal(harness.calls.observe.length, 0);
  assert.equal(harness.model.textAuthority.kind, 'obstructed');
  assert.equal(harness.model.textAuthority.issue.message, 'open blocked');
});

test('real workspace app path exposes no lifecycle authority through production session', async () => {
  const harness = await createWorkspaceEchoAppHarness();

  assert.equal('requestStart' in harness.productionTextSession, false);
  assert.equal('requestRunUntilIdle' in harness.productionTextSession, false);
  assert.equal('requestStop' in harness.productionTextSession, false);
  assert.equal('tick' in harness.productionTextSession, false);
});

test('observed document window helper reports UTF-8 byte offsets', () => {
  const observed = observedDocumentWindow(echoTextDocument('é\nx'), 1, {
    basisHeadId: 'head:test',
    byteRange: {
      startByte: byteOffset(0),
      endByte: byteOffset(4),
    },
    aperture: {
      cursorLine: 0,
      viewportLineCount: 2,
    },
  });

  assert.deepEqual(observed.observed.value.lines.map((line) => ({
    lineNumber: line.lineNumber,
    startByte: line.startByte,
    endByte: line.endByte,
  })), [
    { lineNumber: 0, startByte: 0, endByte: 2 },
    { lineNumber: 1, startByte: 3, endByte: 4 },
  ]);
});
