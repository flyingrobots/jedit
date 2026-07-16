import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';
import {
  basisPinnedTestTextSession,
  fakeTextOperationSequencer,
  importDist,
  mockEditor,
} from './workspace-helpers.mjs';

test('reading cache materializes text and reports explicit postures', async () => {
  const [cacheModule, authorityModule, profile] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-reading-cache.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
  ]);
  const cache = {
    bufferId: 'buffer:notes',
    readingId: 'reading:notes',
    textBasis: {
      basisHeadId: 'head:opened',
      byteRange: { startByte: 0, endByte: 3 },
    },
    lines: ['a', 'b'],
    coverage: 'full',
    lineCount: 2,
    startLine: 0,
    returnedLineCount: 2,
    totalLineCount: 2,
    hasMoreBefore: false,
    hasMoreAfter: false,
    cursorLine: 0,
    viewportLineCount: 24,
    truncated: false,
  };
  const opened = authorityModule.openedWorkspaceTextAuthority({
    profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    readOnly: false,
    dirty: false,
    cache,
  });
  const dirty = authorityModule.workspaceTextAuthorityWithReceipt(opened, 'receipt:1', {
    admittedTickId: 'tick:1',
    nextHeadId: 'head:edited',
  });

  assert.equal(cacheModule.materializeWorkspaceTextReadingCache(cache), 'a\nb');
  assert.equal(authorityModule.workspaceTextAuthorityPosture(opened), cacheModule.WorkspaceTextReadingPostures.Clean);
  assert.equal(authorityModule.workspaceTextAuthorityPosture(dirty), cacheModule.WorkspaceTextReadingPostures.Dirty);
});

test('reading cache projection preserves Vim marks across production refresh', async () => {
  const [cacheModule, mode, syntax, executor] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-reading-cache.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'vim-chord-syntax.js'),
    importDist('app', 'workspace', 'vim-command-executor.js'),
  ]);
  const cache = {
    bufferId: 'buffer:notes',
    readingId: 'reading:notes',
    lines: ['one', '  two'],
    coverage: 'full',
    lineCount: 2,
    startLine: 0,
    returnedLineCount: 2,
    totalLineCount: 2,
    hasMoreBefore: false,
    hasMoreAfter: false,
    cursorLine: 0,
    viewportLineCount: 24,
    truncated: false,
  };
  const existing = mockEditor(mode, {
    lines: cache.lines,
    cursorRow: 1,
    cursorCol: 4,
    pendingVimKeys: ['d'],
    marks: {
      a: {
        basisDigest: 'vim-basis:test',
        column: 4,
        row: 1,
      },
    },
  });

  const projected = cacheModule.editorFromFullWorkspaceTextReadingCache({
    filePath: '/repo/notes.md',
    readOnly: false,
    dirty: false,
    cache,
    existing,
  });
  const exactJump = executor.applyVimChordSyntaxToEditor(
    { ...projected, cursorRow: 0, cursorCol: 0 },
    syntax.parseVimChordSyntax(['`', 'a']),
  );
  const lineJump = executor.applyVimChordSyntaxToEditor(
    { ...projected, cursorRow: 0, cursorCol: 0 },
    syntax.parseVimChordSyntax(["'", 'a']),
  );

  assert.deepEqual(projected.marks, existing.marks);
  assert.equal(projected.pendingVimKeys, undefined);
  assert.deepEqual(
    { row: exactJump.cursorRow, column: exactJump.cursorCol },
    { row: 1, column: 4 },
  );
  assert.deepEqual(
    { row: lineJump.cursorRow, column: lineJump.cursorCol },
    { row: 1, column: 2 },
  );
});

test('text edit planner owns cursor selection and unsupported range posture', async () => {
  const [planner, modeModule] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-edit-planner.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
  ]);
  const editor = {
    path: '/repo/notes.md',
    lines: ['abc', 'def'],
    cursorRow: 0,
    cursorCol: 1,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: modeModule.EditorModes.Normal,
    undoStack: [],
    redoStack: [],
  };

  assert.deepEqual(planner.planWorkspaceTextInsert(editor, 'X'), {
    kind: planner.WorkspaceTextEditPlanKinds.Insert,
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    insertText: 'X',
    cursorAfter: { row: 0, column: 2 },
  });
  assert.deepEqual(planner.planWorkspaceTextDeleteUnderCursor(editor), {
    kind: planner.WorkspaceTextEditPlanKinds.Delete,
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    endByte: { kind: 'utf8-byte-offset', value: 2 },
    cursorAfter: { row: 0, column: 1 },
  });
  assert.deepEqual(planner.planWorkspaceTextSelectionReplace(editor, {
    startRow: 0,
    startColumn: 1,
    endRow: 1,
    endColumn: 2,
  }, 'Z'), {
    kind: planner.WorkspaceTextEditPlanKinds.Replace,
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    endByte: { kind: 'utf8-byte-offset', value: 6 },
    insertText: 'Z',
    cursorAfter: { row: 0, column: 2 },
  });
  assert.deepEqual(planner.planWorkspaceTextSelectionReplace(editor, undefined, 'Z'), {
    kind: planner.WorkspaceTextEditPlanKinds.Unsupported,
    reason: planner.WorkspaceTextEditPlanUnsupportedReasons.Selection,
  });
});

test('text edit planner converts UTF-16 cursor columns to branded UTF-8 bytes', async () => {
  const [planner, modeModule] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-edit-planner.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
  ]);
  const editor = {
    path: '/repo/unicode.txt',
    lines: ['A😀é'],
    cursorRow: 0,
    cursorCol: 3,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: modeModule.EditorModes.Insert,
    undoStack: [],
    redoStack: [],
  };

  assert.deepEqual(planner.planWorkspaceTextInsert(editor, '!').startByte, {
    kind: 'utf8-byte-offset',
    value: 5,
  });
  assert.deepEqual(planner.planWorkspaceTextBackspace(editor), {
    kind: planner.WorkspaceTextEditPlanKinds.Delete,
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    endByte: { kind: 'utf8-byte-offset', value: 5 },
    cursorAfter: { row: 0, column: 1 },
  });
  assert.deepEqual(planner.planWorkspaceTextDeleteUnderCursor({
    ...editor,
    cursorCol: 1,
  }), {
    kind: planner.WorkspaceTextEditPlanKinds.Delete,
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    endByte: { kind: 'utf8-byte-offset', value: 5 },
    cursorAfter: { row: 0, column: 1 },
  });
});

test('replace command submits through production text session and refreshes reading', async () => {
  const commands = await importDist('app', 'workspace', 'workspace-text-commands.js');
  const calls = {
    replace: [],
    observe: [],
  };
  const productionTextSession = basisPinnedTestTextSession({
    replaceRange: async (request) => {
      calls.replace.push(request);
      return {
        kind: 'applied',
        result: { receiptId: 'receipt:replace', textBasis: testTextBasis(21, 'head:replace') },
      };
    },
    observeWindow: async (request) => {
      calls.observe.push(request);
      return {
        kind: 'observed',
        observed: {
          value: {
            readingId: 'reading:replace',
            lines: [{ text: 'replaced from reading' }],
            lineCount: 1,
            cursorLine: 0,
            viewportLineCount: 24,
            truncated: false,
          },
        },
      };
    },
  });
  const message = await commands.createWorkspaceTextEditCmd({
    kind: commands.WorkspaceTextEditCommandKinds.Replace,
    requestId: 7,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    productionTextSession,
    textOperationSequencer: fakeTextOperationSequencer(),
    atMs: 42,
    aperture: commands.defaultWorkspaceTextAperture(),
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    endByte: { kind: 'utf8-byte-offset', value: 4 },
    insertText: 'XYZ',
  })();

  assert.deepEqual(calls.replace, [{
    bufferId: 'buffer:notes',
    startByte: { kind: 'utf8-byte-offset', value: 1 },
    endByte: { kind: 'utf8-byte-offset', value: 4 },
    insertText: 'XYZ',
    atMs: 42,
  }]);
  assert.equal(calls.observe.length, 1);
  assert.equal(message.result.receiptId, 'receipt:replace');
  assert.equal(message.result.cache.lines[0], 'replaced from reading');
});

test('settlement envelope records bounded reading coverage metadata', async () => {
  const commands = await importDist('app', 'workspace', 'workspace-text-commands.js');
  const productionTextSession = basisPinnedTestTextSession({
    insertText: async () => ({
      kind: 'applied',
      result: { receiptId: 'receipt:window', textBasis: testTextBasis(101, 'head:window') },
    }),
    observeWindow: async () => ({
      kind: 'observed',
      observed: {
        value: {
          readingId: 'reading:window',
          lines: [{
            lineNumber: 24,
            text: 'window evidence',
          }],
          startLine: 24,
          lineCount: 1,
          totalLineCount: 40,
          hasMoreBefore: true,
          hasMoreAfter: true,
          cursorLine: 24,
          viewportLineCount: 4,
          truncated: false,
        },
      },
    }),
  });

  const message = await commands.createWorkspaceTextEditCmd({
    kind: commands.WorkspaceTextEditCommandKinds.Insert,
    requestId: 8,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    productionTextSession,
    textOperationSequencer: fakeTextOperationSequencer(),
    atMs: 42,
    aperture: {
      cursorLine: 24,
      viewportLineCount: 4,
      beforeLines: 0,
      afterLines: 0,
      maxBytes: 1048576,
    },
    startByte: { kind: 'utf8-byte-offset', value: 100 },
    insertText: 'Z',
  })();
  const payload = JSON.parse(new TextDecoder().decode(message.result.wscSettlementEnvelope.bytes));

  assert.equal(payload.reading.coverage, 'window');
  assert.equal(payload.reading.startLine, 24);
  assert.equal(payload.reading.returnedLineCount, 1);
  assert.equal(payload.reading.totalLineCount, 40);
  assert.equal(payload.reading.hasMoreBefore, true);
  assert.equal(payload.reading.hasMoreAfter, true);
  assert.equal(payload.reading.truncated, false);
});

function testTextBasis(endByte, basisHeadId) {
  return {
    basisHeadId,
    byteRange: {
      startByte: { kind: 'utf8-byte-offset', value: 0 },
      endByte: { kind: 'utf8-byte-offset', value: endByte },
    },
  };
}

test('production undo and redo submit Echo replacement edits', async () => {
  const harness = await openedHarness({
    hostLines: ['abc'],
    readings: ['abc', 'bc', 'abc', 'bc'],
  });

  await harness.runFirst(await harness.key('x'));
  await harness.runFirst(await harness.key('u'));
  await harness.runFirst(await harness.key('r', { ctrl: true }));

  assert.deepEqual(harness.calls.delete, [{
    bufferId: 'buffer:notes',
    startByte: { kind: 'utf8-byte-offset', value: 0 },
    endByte: { kind: 'utf8-byte-offset', value: 1 },
    atMs: 0,
  }]);
  assert.deepEqual(harness.calls.replace, [
    {
      bufferId: 'buffer:notes',
      startByte: { kind: 'utf8-byte-offset', value: 0 },
      endByte: { kind: 'utf8-byte-offset', value: 0 },
      insertText: 'a',
      atMs: 0,
    },
    {
      bufferId: 'buffer:notes',
      startByte: { kind: 'utf8-byte-offset', value: 0 },
      endByte: { kind: 'utf8-byte-offset', value: 1 },
      insertText: '',
      atMs: 0,
    },
  ]);
  assert.deepEqual(harness.model.editor.lines, ['bc']);
});

test('production insert-mode edits can be undone through Echo', async () => {
  const harness = await openedHarness({
    hostLines: ['a'],
    readings: ['a', 'Xa', 'a'],
  });

  await harness.key('i');
  await harness.runFirst(await harness.key('X', { shift: true }));
  await harness.key('escape');
  await harness.runFirst(await harness.key('u'));

  assert.deepEqual(harness.calls.insert, [{
    bufferId: 'buffer:notes',
    startByte: { kind: 'utf8-byte-offset', value: 0 },
    insertText: 'X',
    atMs: 0,
  }]);
  assert.deepEqual(harness.calls.replace, [{
    bufferId: 'buffer:notes',
    startByte: { kind: 'utf8-byte-offset', value: 0 },
    endByte: { kind: 'utf8-byte-offset', value: 1 },
    insertText: '',
    atMs: 0,
  }]);
  assert.deepEqual(harness.model.editor.lines, ['a']);
});

test('footer renders production text posture without exposing text authority', async () => {
  const harness = await openedHarness();
  const text = harness.renderWorkspaceText();
  const footerContext = text.split('\n').at(-1) ?? '';

  assert.equal(footerContext.startsWith('/repo/notes.md'), true);
  assert.match(footerContext, /\[clean \| main \| fs:materialized/);
  assert.equal(footerContext.endsWith('target:main | +0/-0]'), true);
});

test('source highlighting consumes reading material after production edit', async () => {
  const highlightInputs = [];
  const harness = await openedHarness({
    readings: ['before edit', 'highlight from reading'],
    sourceHighlighter: {
      highlight: async (input) => {
        highlightInputs.push(input);
        return { path: input.path, partial: false, spans: [] };
      },
    },
  });

  await harness.key('i');
  const { commands } = await harness.runFirst(await harness.key('X', { shift: true }));
  await Promise.all(commands.map((command) => command()));

  assert.equal(highlightInputs.at(-1).text, 'highlight from reading');
});

test('preview mode renders reading material instead of stale local lines', async () => {
  const harness = await openedHarness({
    hostLines: ['# stale host'],
    readings: ['# Echo preview'],
  });
  harness.setModel({
    ...harness.model,
    viewMode: 'preview',
    editor: {
      ...harness.model.editor,
      lines: ['# stale local'],
    },
  });

  const text = harness.renderText();

  assert.match(text, /Echo preview/);
  assert.doesNotMatch(text, /stale local/);
});

test('single-buffer policy keeps save targeted to active production buffer', async () => {
  const harness = await createWorkspaceEchoAppHarness({
    entries: [
      { kind: 'file', name: 'a.md', path: '/repo/a.md' },
      { kind: 'file', name: 'b.md', path: '/repo/b.md' },
    ],
    hostLinesByPath: new Map([
      ['/repo/a.md', ['a']],
      ['/repo/b.md', ['b']],
    ]),
    bufferIdByKey: new Map([
      ['/repo/a.md', 'buffer:a'],
      ['/repo/b.md', 'buffer:b'],
    ]),
    readings: ['A reading', 'B reading'],
    exportText: 'B exported',
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    selectedIndex: 1,
    focusPane: 'files',
    fileDrawerOpen: true,
  });
  await harness.runFirst(await harness.key('enter'));
  await harness.run((await harness.key('s', { ctrl: true }))[0]);

  assert.equal(harness.model.textAuthority.filePath, '/repo/b.md');
  assert.equal(harness.model.textAuthority.bufferId, 'buffer:b');
  assert.deepEqual(harness.savedFiles, [{ filePath: '/repo/b.md', lines: ['B exported'] }]);
});

test('non-Echo text runtime profiles are unsupported startup input', async () => {
  const profile = await importDist('app', 'text-runtime-profile.js');

  assert.deepEqual(profile.parseTextRuntimeProfile('testLocal'), {
    kind: profile.TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: profile.TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: 'testLocal',
    requiredProfile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  });
  assert.deepEqual(profile.parseTextRuntimeProfile('legacy'), {
    kind: profile.TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: profile.TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: 'legacy',
    requiredProfile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  });
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
