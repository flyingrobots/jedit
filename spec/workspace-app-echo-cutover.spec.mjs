import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceEchoAppHarness, productionTextObstruction } from './workspace-echo-app-harness.mjs';

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
    startByte: 0,
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
    { startByte: 0, insertText: 'h' },
    { startByte: 1, insertText: 'e' },
    { startByte: 2, insertText: 'l' },
    { startByte: 3, insertText: 'l' },
    { startByte: 4, insertText: 'o' },
  ]);
  assert.equal(harness.model.editor.cursorCol, 5);
  assert.match(harness.renderText(), /hello/);
  assert.doesNotMatch(harness.renderText(), /olleh/);
});

test('real workspace app path renders rapid inserts before Echo observe resolves', async () => {
  const harness = await openedHarness({ readings: ['', 'h', 'he', 'hel', 'hell', 'hello'] });

  await harness.key('i');
  const commands = [];
  for (const character of ['h', 'e', 'l', 'l', 'o']) {
    commands.push(...await harness.key(character));
  }

  assert.equal(harness.calls.insert.length, 0);
  assert.equal(harness.model.editor.cursorCol, 5);
  assert.equal(harness.model.textAuthority.dirty, true);
  assert.equal(harness.model.textAuthority.pendingClientSeq, 6);
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'predicted');
  assert.match(harness.renderText(), /hello/);

  for (const command of commands) {
    await command();
  }

  assert.deepEqual(harness.calls.insert.map((call) => ({
    startByte: call.startByte,
    insertText: call.insertText,
  })), [
    { startByte: 0, insertText: 'h' },
    { startByte: 1, insertText: 'e' },
    { startByte: 2, insertText: 'l' },
    { startByte: 3, insertText: 'l' },
    { startByte: 4, insertText: 'o' },
  ]);
});

test('real workspace app path serializes rapid insert settlement and records each edit', async () => {
  const sentence = "this is an editor and i'm typing in it";
  const document = echoTextDocument('');
  const calls = {
    insert: [],
    observe: [],
  };
  const pendingInserts = [];
  const productionTextSession = {
    openBuffer: async (request) => {
      document.replace(request.initialText);
      return {
        kind: 'opened',
        optic: {
          buffer: {
            bufferId: 'buffer:notes',
          },
        },
      };
    },
    insertText: async (request) => {
      const receiptSequence = calls.insert.length + 1;
      calls.insert.push(request);
      const pending = deferred();
      pendingInserts.push({ pending, request });
      await pending.promise;
      document.insert(request.startByte, request.insertText);
      return {
        kind: 'applied',
        result: {
          receiptId: `receipt:${receiptSequence}`,
        },
      };
    },
    replaceRange: async () => {
      throw new Error('replaceRange should not run for insert typing');
    },
    deleteRange: async () => {
      throw new Error('deleteRange should not run for insert typing');
    },
    multiRangeEdit: async () => productionTextObstruction('multi-range unsupported'),
    checkpointBuffer: async () => ({
      kind: 'checkpointed',
      result: { checkpointId: 'checkpoint:save' },
    }),
    observeWindow: async (request) => {
      calls.observe.push(request);
      return observedDocumentWindow(document, calls.observe.length, request);
    },
    exportSnapshot: async () => ({
      kind: 'exported',
      text: document.lines().join('\n'),
      readingId: 'reading:export',
    }),
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  const commands = [];
  for (const character of sentence) {
    commands.push(...await harness.key(character));
  }
  const commandMessages = commands.map((command) => command());
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.insert.length, 1, 'only one Echo mutation should be in flight before the first settles');

  for (let index = 0; index < sentence.length; index += 1) {
    await waitForPendingInsertCount(pendingInserts, index + 1);
    pendingInserts[index].pending.resolve();
    await applyWorkspaceMessage(harness, await commandMessages[index]);
  }

  assert.equal(harness.model.editor.lines[0], sentence);
  assert.equal(harness.model.echoHistory.filter((entry) => entry.kind === 'edit').length, sentence.length);
  assert.equal(harness.model.echoHistory.at(-1).summary, '/repo/notes.md');
});

test('real workspace app path waits for queued rapid inserts before saving', async () => {
  const sentence = "this is an editor and i'm typing in it";
  const document = echoTextDocument('');
  const calls = {
    insert: [],
    observe: [],
    export: [],
    checkpoint: [],
  };
  const pendingInserts = [];
  const productionTextSession = {
    openBuffer: async (request) => {
      document.replace(request.initialText);
      return {
        kind: 'opened',
        optic: {
          buffer: {
            bufferId: 'buffer:notes',
          },
        },
      };
    },
    insertText: async (request) => {
      const receiptSequence = calls.insert.length + 1;
      calls.insert.push(request);
      const pending = deferred();
      pendingInserts.push({ pending, request });
      await pending.promise;
      document.insert(request.startByte, request.insertText);
      return {
        kind: 'applied',
        result: {
          receiptId: `receipt:${receiptSequence}`,
        },
      };
    },
    replaceRange: async () => {
      throw new Error('replaceRange should not run for insert typing');
    },
    deleteRange: async () => {
      throw new Error('deleteRange should not run for insert typing');
    },
    multiRangeEdit: async () => productionTextObstruction('multi-range unsupported'),
    checkpointBuffer: async (request) => {
      calls.checkpoint.push(request);
      return {
        kind: 'checkpointed',
        result: { checkpointId: 'checkpoint:save' },
      };
    },
    observeWindow: async (request) => {
      calls.observe.push(request);
      return observedDocumentWindow(document, calls.observe.length, request);
    },
    exportSnapshot: async (request) => {
      calls.export.push(request);
      return {
        kind: 'exported',
        text: document.lines().join('\n'),
        readingId: 'reading:export',
      };
    },
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  const editCommands = [];
  for (const character of sentence) {
    editCommands.push(...await harness.key(character));
  }
  const editMessages = editCommands.map((command) => command());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.insert.length, 1, 'rapid typing should still admit only one Echo mutation at a time');

  const saveCommands = await harness.key('s', { ctrl: true });
  assert.equal(saveCommands.length, 1);
  const saveMessage = saveCommands[0]();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.export.length, 0, 'save must not export a partial Echo frontier while edits are queued');
  assert.deepEqual(harness.savedFiles, []);

  for (let index = 0; index < sentence.length; index += 1) {
    await waitForPendingInsertCount(pendingInserts, index + 1);
    pendingInserts[index].pending.resolve();
    await applyWorkspaceMessage(harness, await editMessages[index]);
  }

  const [exportedModel, checkpointCommands] = harness.runtime.update(await saveMessage, harness.model);
  harness.setModel(exportedModel);
  await harness.runAll(checkpointCommands);

  assert.deepEqual(harness.savedFiles, [{ filePath: '/repo/notes.md', lines: [sentence] }]);
  assert.equal(calls.export.length, 1);
  assert.equal(calls.checkpoint.length, 1);
  assert.equal(harness.model.editor.lines[0], sentence);
  assert.equal(harness.model.textAuthority.lastExportReadingId, 'reading:export');
  assert.equal(harness.model.textAuthority.lastCheckpointId, 'checkpoint:save');
  assert.equal(harness.model.textAuthority.dirty, false);
});

test('real workspace app path cancels a queued save after an edit obstruction', async () => {
  const pendingInsert = deferred();
  const calls = {
    insert: [],
    export: [],
    checkpoint: [],
  };
  const productionTextSession = {
    openBuffer: async () => ({
      kind: 'opened',
      optic: {
        buffer: {
          bufferId: 'buffer:notes',
        },
      },
    }),
    insertText: async (request) => {
      calls.insert.push(request);
      await pendingInsert.promise;
      return productionTextObstruction('footprint changed');
    },
    replaceRange: async () => {
      throw new Error('replaceRange should not run for insert typing');
    },
    deleteRange: async () => {
      throw new Error('deleteRange should not run for insert typing');
    },
    multiRangeEdit: async () => productionTextObstruction('multi-range unsupported'),
    checkpointBuffer: async (request) => {
      calls.checkpoint.push(request);
      return {
        kind: 'checkpointed',
        result: { checkpointId: 'checkpoint:save' },
      };
    },
    observeWindow: async (request) => observedDocumentWindow(echoTextDocument(''), 1, request),
    exportSnapshot: async (request) => {
      calls.export.push(request);
      return {
        kind: 'exported',
        text: '',
        readingId: 'reading:export',
      };
    },
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  const editCommands = await harness.key('X', { shift: true });
  const editMessage = editCommands[0]();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.insert.length, 1);

  const saveCommands = await harness.key('s', { ctrl: true });
  const saveMessage = saveCommands[0]();
  await Promise.resolve();
  assert.equal(calls.export.length, 0);

  pendingInsert.resolve();
  await applyWorkspaceMessage(harness, await editMessage);
  const [afterSave, afterSaveCommands] = harness.runtime.update(await saveMessage, harness.model);
  harness.setModel(afterSave);

  assert.equal(afterSaveCommands.length, 0);
  assert.equal(calls.export.length, 0);
  assert.equal(calls.checkpoint.length, 0);
  assert.deepEqual(harness.savedFiles, []);
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'obstructed');
  assert.equal(harness.model.textAuthority.dirty, true);
});

test('real workspace app path keeps newline insertion past bounded Echo readings', async () => {
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
        optic: {
          buffer: {
            bufferId: 'buffer:notes',
          },
        },
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
  for (let index = 0; index < 40; index += 1) {
    await harness.runAll(await harness.key('enter'));
  }
  await harness.runAll(await harness.key('Z', { shift: true }));

  assert.equal(harness.model.editor.cursorRow, 40);
  assert.equal(harness.model.editor.cursorCol, 1);
  assert.equal(harness.model.editor.lines.length, 41);
  assert.equal(harness.model.editor.lines[40], 'Z');
  assert.equal(harness.model.textAuthority.cache.coverage, 'window');
  assert.equal(harness.model.textAuthority.cache.truncated, false);
  assert.equal(calls.insert.length, 41);
  assert.deepEqual(calls.insert.at(-1), {
    bufferId: 'buffer:notes',
    startByte: 40,
    insertText: 'Z',
    atMs: 0,
  });
});

test('real workspace app path keeps optimistic text visible when Echo obstructs an edit', async () => {
  const harness = await openedHarness({
    readings: [''],
    editObstruction: productionTextObstruction('footprint changed'),
  });

  await harness.key('i');
  const commands = await harness.key('X', { shift: true });
  assert.match(harness.renderText(), /X/);

  await harness.runFirst(commands);

  assert.match(harness.renderText(), /X/);
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'obstructed');
  assert.equal(harness.model.textAuthority.lastObstruction.message, 'footprint changed');
  assert.equal(harness.model.echoHistory.at(-1).status, 'obstructed');
  assert.match(harness.model.echoHistory.at(-1).summary, /footprint changed/);
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
    { startByte: 0, insertText: 'h' },
    { startByte: 1, insertText: 'i' },
    { startByte: 2, insertText: ' ' },
    { startByte: 3, insertText: 'x' },
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

async function twoFileHarness(options = {}) {
  return createWorkspaceEchoAppHarness({
    filePath: '/repo/a.txt',
    fileName: 'a.txt',
    entries: [
      { kind: 'file', name: 'a.txt', path: '/repo/a.txt' },
      { kind: 'file', name: 'b.txt', path: '/repo/b.txt' },
    ],
    bufferIdByKey: new Map([
      ['/repo/a.txt', 'buffer:a'],
      ['/repo/b.txt', 'buffer:b'],
    ]),
    ...options,
  });
}

async function openFileDrawerIndex(harness, selectedIndex) {
  harness.setModel({
    ...harness.model,
    fileDrawerOpen: true,
    focusPane: 'files',
    selectedIndex,
  });
}

function echoTextDocument(initialText) {
  let text = initialText;
  return {
    insert(startByte, insertText) {
      text = `${text.slice(0, startByte)}${insertText}${text.slice(startByte)}`;
    },
    replace(nextText) {
      text = nextText;
    },
    lines() {
      return text.split('\n');
    },
  };
}

function observedDocumentWindow(document, sequence, request) {
  const lines = document.lines();
  const startLine = Math.max(0, request.aperture.cursorLine);
  const visibleLines = lines.slice(startLine, startLine + request.aperture.viewportLineCount);
  return {
    kind: 'observed',
    observed: {
      value: {
        readingId: `reading:${sequence}`,
        lines: visibleLines.map((text, index) => ({
          lineNumber: startLine + index,
          startByte: byteOffsetAtLine(lines, startLine + index),
          endByte: byteOffsetAtLine(lines, startLine + index) + Buffer.byteLength(text, 'utf8'),
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
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitForPendingInsertCount(pendingInserts, count) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (pendingInserts.length >= count) {
      return;
    }
    await Promise.resolve();
  }
  assert.equal(pendingInserts.length, count);
}

async function applyWorkspaceMessage(harness, message) {
  const [nextModel] = harness.runtime.update(message, harness.model);
  harness.setModel(nextModel);
}

function byteOffsetAtLine(lines, targetLine) {
  let offset = 0;
  for (let line = 0; line < targetLine; line += 1) {
    offset += Buffer.byteLength(lines[line] ?? '', 'utf8') + 1;
  }
  return offset;
}
