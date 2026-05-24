import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockDeps,
  mockI18n,
  mockJeditTheme,
  mockRuntime,
  surfaceText,
} from './workspace-helpers.mjs';

test('file open routes through production text session and applies initial bounded reading', async () => {
  const [initModule, fileTree, fileSystem, runtimeModule, authority, results] = await Promise.all([
    importDist('app', 'workspace', 'init.js'),
    importDist('app', 'workspace', 'file-tree.js'),
    importDist('ports', 'file-system.js'),
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'workspace', 'workspace-text-results.js'),
  ]);
  const filePath = '/repo/notes.md';
  const openedBuffers = [];
  const observedBuffers = [];
  const model = initModule.createInitialModel('/repo', 120, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [{ kind: fileSystem.FileEntryKinds.File, name: 'notes.md', path: filePath }],
    nowMs: 100,
  });
  const productionTextSession = {
    openBuffer: async (request) => {
      openedBuffers.push(request);
      return {
        kind: 'opened',
        optic: {
          buffer: {
            bufferId: 'buffer:notes',
          },
        },
      };
    },
    observeWindow: async (request) => {
      observedBuffers.push(request);
      return {
        kind: 'observed',
        observed: {
          value: {
            readingId: 'reading:notes',
            lines: [
              { text: 'hello' },
              { text: 'world' },
            ],
            lineCount: 2,
            cursorLine: 0,
            viewportLineCount: 24,
            truncated: false,
          },
        },
      };
    },
  };

  const [pendingModel, commands] = fileTree.updateTreeFromKey(
    { key: 'enter' },
    model,
    () => 123,
    mockDeps({
      editorFile: {
        loadEditorFile: () => ({ lines: ['hello', 'world'], readOnly: false }),
        saveEditorFile: () => undefined,
      },
      productionTextSession,
    }),
  );
  const message = await commands[0]();

  assert.equal(pendingModel.textAuthority.kind, authority.WorkspaceTextAuthorityKinds.PendingOpen);
  assert.equal(pendingModel.textRequestId, 1);
  assert.equal(message.type, 'text-open-result');
  assert.equal(message.result.kind, results.WorkspaceTextResultKinds.Opened);
  assert.deepEqual(openedBuffers, [{
    bufferKey: filePath,
    initialText: 'hello\nworld',
    projectionPath: filePath,
    atMs: 123,
  }]);
  assert.deepEqual(observedBuffers, [{
    bufferId: 'buffer:notes',
    aperture: {
      cursorLine: 0,
      viewportLineCount: 24,
      beforeLines: 0,
      afterLines: 0,
      maxBytes: 1048576,
    },
    atMs: 123,
  }]);

  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({ productionTextSession }));
  const [openedModel] = runtime.update(message, pendingModel);

  assert.equal(openedModel.textAuthority.kind, authority.WorkspaceTextAuthorityKinds.Opened);
  assert.equal(openedModel.textAuthority.bufferId, 'buffer:notes');
  assert.equal(openedModel.textAuthority.cache.readingId, 'reading:notes');
  assert.deepEqual(openedModel.editor.lines, ['hello', 'world']);
  assert.equal(openedModel.editor.dirty, false);
  assert.equal(openedModel.editor.readOnly, false);
});

test('viewer renders production text from reading cache instead of stale editor lines', async () => {
  const [viewerContent, modeModule, authority, profile] = await Promise.all([
    importDist('app', 'workspace', 'viewer-content.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
  ]);
  const model = {
    editor: {
      path: '/repo/notes.txt',
      lines: ['stale local line'],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: false,
      mode: modeModule.EditorModes.Normal,
      undoStack: [],
      redoStack: [],
    },
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: '/repo/notes.txt',
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: false,
      cache: {
        bufferId: 'buffer:notes',
        readingId: 'reading:fresh',
        lines: ['fresh Echo reading'],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
    viewMode: 'source',
    sourceHighlight: undefined,
    time: 0,
    jeditTheme: mockJeditTheme(),
    titleCamera: { angle: 0, radius: 0 },
    titleSceneSeed: 0,
    titleMeshes: {},
    sceneOverride: undefined,
    titleRenderMode: 'braille',
    titleAsciiPalette: 'dense',
  };

  const surface = viewerContent.renderViewer(model, 80, 16);
  const text = surfaceText(surface);

  assert.match(text, /fresh Echo reading/);
  assert.doesNotMatch(text, /stale local line/);
});
