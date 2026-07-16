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
  waitForPendingInsertCount,
} from './workspace-echo-test-utils.mjs';

test('echoTextDocument inserts at UTF-8 byte coordinates', () => {
  const document = echoTextDocument('aé💥z');

  document.insert(Buffer.byteLength('aé', 'utf8'), '-');

  assert.deepEqual(document.lines(), ['aé-💥z']);
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
      basisHeadId: 'head:export',
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
  await waitForItemCount(calls.insert, 1, 'insert call');

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
        basisHeadId: `head:test:edit:${sentence.length}`,
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
  await waitForItemCount(calls.insert, 1, 'insert call');
  assert.equal(calls.insert.length, 1, 'rapid typing should still admit only one Echo mutation at a time');

  const saveCommands = await harness.key('s', { ctrl: true });
  assert.equal(saveCommands.length, 1);
  const saveMessage = saveCommands[0]();
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
  const saveMessage = saveCommands[0]();
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
  assert.equal(harness.model.textAuthority.dirty, false);
});

test('real workspace app path admits final queued edit before export obstruction', async () => {
  const pendingInsert = deferred();
  const document = echoTextDocument('');
  const calls = {
    insert: [],
    export: [],
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
  const saveMessage = saveCommands[0]();

  pendingInsert.resolve();
  await applyWorkspaceMessage(harness, await editMessage);
  const [afterSave] = harness.runtime.update(await saveMessage, harness.model);
  harness.setModel(afterSave);

  assert.equal(calls.insert.length, 1);
  assert.equal(calls.export.length, 1);
  assert.equal(harness.model.textAuthority.pendingReceiptId, 'receipt:insert');
  assert.equal(harness.model.textAuthority.pendingIntentStatus, 'admitted');
  assert.equal(harness.model.textAuthority.dirty, true);
  assert.equal(harness.model.textAuthority.lastObstruction, undefined);
  assert.equal(harness.model.echoHistory.at(-1).status, 'obstructed');
});
