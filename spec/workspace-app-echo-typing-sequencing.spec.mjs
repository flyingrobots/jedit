import assert from 'node:assert/strict';
import test from 'node:test';
import { productionTextObstruction } from './workspace-echo-app-harness.mjs';
import {
  applyWorkspaceMessage,
  deferred,
  echoTextDocument,
  observedDocumentWindow,
  openedHarness,
  waitForItemCount,
} from './workspace-echo-test-utils.mjs';

test('echoTextDocument inserts at UTF-8 byte coordinates', () => {
  const document = echoTextDocument('aé💥z');

  document.insert(Buffer.byteLength('aé', 'utf8'), '-');

  assert.deepEqual(document.lines(), ['aé-💥z']);
});

test('real workspace app path refuses dependent inserts until Echo settles', async () => {
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
        bufferId: 'buffer:notes',
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
      basisHeadId: 'head:export',
    }),
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  const [firstCharacter, ...dependentCharacters] = sentence;
  const commands = await harness.key(firstCharacter);
  for (const character of dependentCharacters) {
    assert.deepEqual(await harness.key(character), []);
  }
  const commandMessages = commands.map((command) => command());
  await waitForItemCount(calls.insert, 1, 'insert call');

  assert.equal(calls.insert.length, 1, 'only one Echo mutation may be proposed from the observed basis');
  assert.deepEqual(harness.model.editor.lines, [''], 'dependent keystrokes must not materialize locally');

  pendingInserts[0].pending.resolve();
  await applyWorkspaceMessage(harness, await commandMessages[0]);

  assert.equal(harness.model.editor.lines[0], firstCharacter);
  assert.equal(harness.model.textAuthority.lastReceiptId, 'receipt:1');
  assert.equal('echoHistory' in harness.model, false);
});

test('real workspace app path refuses save until the edit has an Echo-observed basis', async () => {
  const insertedText = 'x';
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
        bufferId: 'buffer:notes',
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
        basisHeadId: 'head:test:edit:1',
      };
    },
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  const editCommands = await harness.key(insertedText);
  const editMessages = editCommands.map((command) => command());
  await waitForItemCount(calls.insert, 1, 'insert call');
  assert.equal(calls.insert.length, 1);

  const saveCommands = await harness.key('s', { ctrl: true });
  assert.equal(saveCommands.length, 0);
  assert.equal(calls.export.length, 0, 'save must not export a partial Echo frontier');
  assert.deepEqual(harness.savedFiles, []);

  pendingInserts[0].pending.resolve();
  await applyWorkspaceMessage(harness, await editMessages[0]);

  const observedSaveCommands = await harness.key('s', { ctrl: true });
  assert.equal(observedSaveCommands.length, 1);
  await harness.runAll(observedSaveCommands);

  assert.deepEqual(harness.savedFiles, [{ filePath: '/repo/notes.md', lines: [insertedText] }]);
  assert.equal(calls.export.length, 1);
  assert.equal(calls.checkpoint.length, 1);
  assert.equal(harness.model.editor.lines[0], insertedText);
  assert.equal(harness.model.textAuthority.lastExportReadingId, 'reading:export');
  assert.equal(harness.model.textAuthority.lastCheckpointId, 'checkpoint:save');
  assert.equal(harness.model.textAuthority.dirty, false);
});

test('real workspace app path never queues a save behind an edit obstruction', async () => {
  const pendingInsert = deferred();
  const calls = {
    insert: [],
    export: [],
    checkpoint: [],
  };
  const productionTextSession = {
    openBuffer: async () => ({
      kind: 'opened',
      bufferId: 'buffer:notes',
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
        basisHeadId: 'head:export',
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
  await waitForItemCount(calls.insert, 1, 'insert call');
  assert.equal(calls.insert.length, 1);

  const saveCommands = await harness.key('s', { ctrl: true });
  assert.equal(saveCommands.length, 0);
  assert.equal(calls.export.length, 0);

  pendingInsert.resolve();
  await applyWorkspaceMessage(harness, await editMessage);

  assert.equal(calls.export.length, 0);
  assert.equal(calls.checkpoint.length, 0);
  assert.deepEqual(harness.savedFiles, []);
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'obstructed');
  assert.equal(harness.model.textAuthority.dirty, false);
});

test('real workspace app path exports only after the edit settles', async () => {
  const pendingInsert = deferred();
  const document = echoTextDocument('');
  const calls = {
    insert: [],
    export: [],
  };
  const productionTextSession = {
    openBuffer: async () => ({
      kind: 'opened',
      bufferId: 'buffer:notes',
    }),
    insertText: async (request) => {
      calls.insert.push(request);
      await pendingInsert.promise;
      document.insert(request.startByte, request.insertText);
      return {
        kind: 'applied',
        result: {
          receiptId: 'receipt:insert',
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
    observeWindow: async (request) => observedDocumentWindow(document, 1, request),
    exportSnapshot: async (request) => {
      calls.export.push(request);
      return productionTextObstruction('export blocked');
    },
  };
  const harness = await openedHarness({
    hostLines: [''],
    productionTextSession,
  });

  await harness.key('i');
  const editCommands = await harness.key('X', { shift: true });
  const editMessage = editCommands[0]();
  await waitForItemCount(calls.insert, 1, 'insert call');
  const saveCommands = await harness.key('s', { ctrl: true });
  assert.equal(saveCommands.length, 0);

  pendingInsert.resolve();
  await applyWorkspaceMessage(harness, await editMessage);
  const observedSaveCommands = await harness.key('s', { ctrl: true });
  assert.equal(observedSaveCommands.length, 1);
  await harness.runFirst(observedSaveCommands);

  assert.equal(calls.insert.length, 1);
  assert.equal(calls.export.length, 1);
  assert.equal(harness.model.textAuthority.pendingReceiptId, 'receipt:insert');
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'admitted');
  assert.equal(harness.model.textAuthority.dirty, true);
  assert.equal(harness.model.textAuthority.lastObstruction, undefined);
  assert.match(harness.model.notifications.items.at(-1).message, /export blocked/);
});
