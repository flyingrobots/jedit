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

function byteOffsetAtLine(lines, targetLine) {
  let offset = 0;
  for (let line = 0; line < targetLine; line += 1) {
    offset += (lines[line] ?? '').length + 1;
  }
  return offset;
}
