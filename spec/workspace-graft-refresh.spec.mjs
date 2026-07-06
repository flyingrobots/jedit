import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

async function loadWorkspaceModules() {
  const [editorSession, editorMode] = await Promise.all([
    importDist('app', 'workspace', 'editor-session.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
  ]);
  return { editorSession, editorMode };
}

test('Graft refresh sends live editor source text with the file request', async () => {
  const { editorSession, editorMode } = await loadWorkspaceModules();
  const requests = [];
  const graftSession = {
    loadGraftInfo: async (request) => {
      requests.push(request);
      return {
        path: request.filePath,
        relativePath: 'demo.edict',
        dirty: request.dirty,
        outlineItems: [],
        changeLines: [],
      };
    },
    failedGraftInfo: (request) => ({
      path: request.filePath,
      relativePath: 'demo.edict',
      dirty: request.dirty,
      outlineItems: [],
      changeLines: [],
      error: request.message,
    }),
    closeConnection: async () => undefined,
  };
  const model = {
    workspaceRoot: '/repo',
    graftInfo: undefined,
    graftLoading: false,
    graftRequestId: 0,
    graftSelectedIndex: 0,
    editor: {
      path: '/repo/demo.edict',
      lines: [
        'package demo.echo@1;',
        'intent replaceThing(input: Input) returns Output {',
        '  return { id: input.id };',
        '}',
      ],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: true,
      readOnly: false,
      mode: editorMode.EditorModes.Normal,
      undoStack: [],
      redoStack: [],
    },
  };

  const [refreshing, commands] = editorSession.beginGraftRefresh(model, { force: true }, graftSession);

  assert.equal(refreshing.graftLoading, true);
  assert.equal(commands.length, 1);

  await commands[0]();

  assert.deepEqual(requests, [{
    workspaceRoot: '/repo',
    filePath: '/repo/demo.edict',
    dirty: true,
    sourceText: [
      'package demo.echo@1;',
      'intent replaceThing(input: Input) returns Output {',
      '  return { id: input.id };',
      '}',
    ].join('\n'),
  }]);
});
