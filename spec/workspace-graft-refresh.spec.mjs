import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

async function loadWorkspaceModules() {
  const [editorSession, editorMode, runtimeState, workspaceBufferRegistry] = await Promise.all([
    importDist('app', 'workspace', 'editor-session.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'runtime-state.js'),
    importDist('app', 'workspace', 'workspace-buffer-registry.js'),
  ]);
  return { editorSession, editorMode, runtimeState, workspaceBufferRegistry };
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

test('Graft refresh does not reuse live-buffer projections for changed dirty text', async () => {
  const { editorSession, editorMode } = await loadWorkspaceModules();
  const requests = [];
  const graftSession = {
    loadGraftInfo: async (request) => {
      requests.push(request);
      return {
        path: request.filePath,
        relativePath: 'demo.edict',
        dirty: request.dirty,
        projectionSource: 'live-buffer',
        projectionPosture: 'current',
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
    graftInfo: {
      path: '/repo/demo.edict',
      relativePath: 'demo.edict',
      dirty: true,
      projectionSource: 'live-buffer',
      projectionPosture: 'current',
      outlineItems: [],
      changeLines: [],
    },
    graftLoading: false,
    graftRequestId: 7,
    graftSelectedIndex: 0,
    editor: {
      path: '/repo/demo.edict',
      lines: [
        'package demo.echo@1;',
        'intent changed(input: Input) returns Output {',
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

  const [refreshing, commands] = editorSession.beginGraftRefresh(model, { force: false }, graftSession);

  assert.equal(refreshing.graftLoading, true);
  assert.equal(commands.length, 1);

  await commands[0]();

  assert.deepEqual(requests.map((request) => request.sourceText), [[
    'package demo.echo@1;',
    'intent changed(input: Input) returns Output {',
    '  return { id: input.id };',
    '}',
  ].join('\n')]);
});

test('Graft refresh clears expanded review payload state for a different file', async () => {
  const { editorSession, editorMode } = await loadWorkspaceModules();
  const graftSession = {
    loadGraftInfo: async (request) => ({
      path: request.filePath,
      relativePath: 'other.edict',
      dirty: request.dirty,
      projectionSource: 'live-buffer',
      projectionPosture: 'current',
      outlineItems: [],
      changeLines: [],
    }),
    failedGraftInfo: (request) => ({
      path: request.filePath,
      relativePath: 'other.edict',
      dirty: request.dirty,
      outlineItems: [],
      changeLines: [],
      error: request.message,
    }),
    closeConnection: async () => undefined,
  };
  const model = {
    workspaceRoot: '/repo',
    graftInfo: {
      path: '/repo/demo.edict',
      relativePath: 'demo.edict',
      dirty: true,
      projectionSource: 'live-buffer',
      projectionPosture: 'current',
      projectionLanes: [{
        title: 'edict core',
        state: 'available',
        metadata: [],
        summaryLines: [],
        reviewPayload: { apiVersion: 'edict.core/v1' },
      }],
      outlineItems: [],
      changeLines: [],
    },
    expandedProjectionLaneIndex: 0,
    graftLoading: false,
    graftRequestId: 7,
    graftSelectedIndex: 0,
    editor: {
      path: '/repo/other.edict',
      lines: ['package demo.other@1;'],
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

  const [refreshing] = editorSession.beginGraftRefresh(model, { force: true }, graftSession);

  assert.equal(refreshing.expandedProjectionLaneIndex, undefined);
  assert.equal(refreshing.graftInfo, undefined);
});

test('Graft refresh clears stale expanded review payload state when lanes change', async () => {
  const { runtimeState } = await loadWorkspaceModules();
  const nextModel = runtimeState.applyGraftInfo({
    graftSelectedIndex: 0,
    expandedProjectionLaneIndex: 0,
  }, {
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    dirty: true,
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [{
      title: 'edict core',
      state: 'available',
      metadata: [],
      summaryLines: [],
    }],
    outlineItems: [],
    changeLines: [],
  });

  assert.equal(nextModel.expandedProjectionLaneIndex, undefined);
});

test('Workspace buffer switches clear expanded review payload state', async () => {
  const { editorMode, workspaceBufferRegistry } = await loadWorkspaceModules();
  const editor = {
    path: '/repo/other.edict',
    lines: ['package demo.other@1;'],
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: true,
    readOnly: false,
    mode: editorMode.EditorModes.Normal,
    undoStack: [],
    redoStack: [],
  };
  const record = {
    bufferId: 'other',
    pathBinding: '/repo/other.edict',
    textAuthority: {
      kind: 'opened',
      bufferId: 'other',
      filePath: '/repo/other.edict',
      materialization: 'materialized',
    },
    editorProjection: editor,
    materializationState: 'materialized',
    graftInfo: {
      path: '/repo/other.edict',
      relativePath: 'other.edict',
      dirty: true,
      projectionSource: 'live-buffer',
      projectionPosture: 'current',
      projectionLanes: [{
        title: 'edict core',
        state: 'available',
        metadata: [],
        summaryLines: [],
        reviewPayload: { apiVersion: 'edict.core/v1' },
      }],
      outlineItems: [],
      changeLines: [],
    },
    graftSelectedIndex: 0,
    lastActivatedAt: 0,
  };

  const activated = workspaceBufferRegistry.activateWorkspaceBufferRecord({
    buffers: {},
    expandedProjectionLaneIndex: 0,
  }, record, 1);
  const cleared = workspaceBufferRegistry.clearActiveWorkspaceBuffer({
    expandedProjectionLaneIndex: 0,
  });

  assert.equal(activated.expandedProjectionLaneIndex, undefined);
  assert.equal(cleared.expandedProjectionLaneIndex, undefined);
});
