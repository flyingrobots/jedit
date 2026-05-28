import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';
import { importDist } from './workspace-helpers.mjs';

test('reading cache materializes text and reports explicit postures', async () => {
  const [cacheModule, authorityModule, profile] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-reading-cache.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
  ]);
  const cache = {
    bufferId: 'buffer:notes',
    readingId: 'reading:notes',
    lines: ['a', 'b'],
    lineCount: 2,
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
  const dirty = authorityModule.workspaceTextAuthorityWithReceipt(opened, 'receipt:1');

  assert.equal(cacheModule.materializeWorkspaceTextReadingCache(cache), 'a\nb');
  assert.equal(authorityModule.workspaceTextAuthorityPosture(opened), cacheModule.WorkspaceTextReadingPostures.Clean);
  assert.equal(authorityModule.workspaceTextAuthorityPosture(dirty), cacheModule.WorkspaceTextReadingPostures.Dirty);
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
    startByte: 1,
    insertText: 'X',
  });
  assert.deepEqual(planner.planWorkspaceTextDeleteUnderCursor(editor), {
    kind: planner.WorkspaceTextEditPlanKinds.Delete,
    startByte: 1,
    endByte: 2,
  });
  assert.deepEqual(planner.planWorkspaceTextSelectionReplace(editor, {
    startRow: 0,
    startColumn: 1,
    endRow: 1,
    endColumn: 2,
  }, 'Z'), {
    kind: planner.WorkspaceTextEditPlanKinds.Replace,
    startByte: 1,
    endByte: 6,
    insertText: 'Z',
  });
  assert.deepEqual(planner.planWorkspaceTextSelectionReplace(editor, undefined, 'Z'), {
    kind: planner.WorkspaceTextEditPlanKinds.Unsupported,
    reason: planner.WorkspaceTextEditPlanUnsupportedReasons.Selection,
  });
});

test('replace command submits through production text session and refreshes reading', async () => {
  const commands = await importDist('app', 'workspace', 'workspace-text-commands.js');
  const calls = {
    replace: [],
    observe: [],
  };
  const productionTextSession = {
    replaceRange: async (request) => {
      calls.replace.push(request);
      return { kind: 'applied', result: { receiptId: 'receipt:replace' } };
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
  };
  const message = await commands.createWorkspaceTextEditCmd({
    kind: commands.WorkspaceTextEditCommandKinds.Replace,
    requestId: 7,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    productionTextSession,
    atMs: 42,
    aperture: commands.defaultWorkspaceTextAperture(),
    startByte: 1,
    endByte: 4,
    insertText: 'XYZ',
  })();

  assert.deepEqual(calls.replace, [{
    bufferId: 'buffer:notes',
    startByte: 1,
    endByte: 4,
    insertText: 'XYZ',
    atMs: 42,
  }]);
  assert.equal(calls.observe.length, 1);
  assert.equal(message.result.receiptId, 'receipt:replace');
  assert.equal(message.result.cache.lines[0], 'replaced from reading');
});

test('production undo and redo are explicit unsupported posture not local mutation', async () => {
  const harness = await openedHarness();
  const beforeLines = harness.model.editor.lines;

  const undoCommands = await harness.key('u');
  const undoMessage = undoCommands[0]();
  const redoCommands = await harness.key('r', { ctrl: true });
  const redoMessage = redoCommands[0]();

  assert.equal(undoMessage.type, 'runtime-issue');
  assert.match(undoMessage.issue.message, /explicit causal input/);
  assert.equal(redoMessage.type, 'runtime-issue');
  assert.match(redoMessage.issue.message, /explicit causal input/);
  assert.equal(harness.model.editor.lines, beforeLines);
});

test('footer renders production text posture without exposing text authority', async () => {
  const harness = await openedHarness();
  const text = harness.renderWorkspaceText();

  assert.match(text, /notes\.md \[clean\]/);
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

test('test-local profile is explicit fixture fallback and invalid profile falls back to Echo-hosted', async () => {
  const profile = await importDist('app', 'text-runtime-profile.js');

  assert.deepEqual(profile.parseTextRuntimeProfile('testLocal'), {
    kind: profile.TEXT_RUNTIME_PROFILE_PARSE_OK,
    profile: profile.TEXT_RUNTIME_PROFILE_TEST_LOCAL,
  });
  assert.deepEqual(profile.parseTextRuntimeProfile('legacy'), {
    kind: profile.TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: profile.TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: 'legacy',
    fallbackProfile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
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
