import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationState } from "@flyingrobots/bijou-tui";
import {
  importDist,
  mockDeps,
  mockI18n,
  mockJeditTheme,
  mockKeyBindingContext,
  mockRuntime,
  surfaceText,
} from "./workspace-helpers.mjs";

const HOST_FINGERPRINT_A = Object.freeze({
  algorithm: "sha256",
  digest: "host-a",
  byteLength: 6,
});
const HOST_FINGERPRINT_B = Object.freeze({
  algorithm: "sha256",
  digest: "host-b",
  byteLength: 8,
});
const EXISTING_SAVE_BLOCK_CASES = Object.freeze([
  {
    title: "disk content changed externally after open",
    observed: () => ({
      lines: ["external"],
      readOnly: false,
      fingerprint: HOST_FINGERPRINT_B,
    }),
    message: /changed on disk after open/,
  },
  {
    title: "disk file was deleted externally after open",
    observed: (filePath) => ({ kind: "missing", filePath }),
    message: /was deleted after open/,
  },
  {
    title: "path became a directory after open",
    observed: (filePath) => ({ kind: "directory", filePath }),
    message: /is a directory/,
  },
]);

test("file open routes through production text session and applies initial bounded reading", async () => {
  const [initModule, fileTree, fileSystem, runtimeModule, authority, results] =
    await Promise.all([
      importDist("app", "workspace", "init.js"),
      importDist("app", "workspace", "file-tree.js"),
      importDist("ports", "file-system.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  const filePath = "/repo/notes.md";
  const openedBuffers = [];
  const observedBuffers = [];
  const model = initModule.createInitialModel("/repo", 120, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "notes.md",
        path: filePath,
      },
    ],
    nowMs: 100,
  });
  const productionTextSession = {
    openBuffer: async (request) => {
      openedBuffers.push(request);
      return {
        kind: "opened",
        optic: {
          buffer: {
            bufferId: "buffer:notes",
          },
        },
      };
    },
    observeWindow: async (request) => {
      observedBuffers.push(request);
      return {
        kind: "observed",
        observed: {
          value: {
            readingId: "reading:notes",
            lines: [{ text: "hello" }, { text: "world" }],
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
    { key: "enter" },
    model,
    () => 123,
    mockDeps({
      editorFile: {
        loadEditorFile: () => ({ lines: ["hello", "world"], readOnly: false }),
        saveEditorFile: () => undefined,
      },
      productionTextSession,
    }),
  );
  const message = await commands[0]();

  assert.equal(
    pendingModel.textAuthority.kind,
    authority.WorkspaceTextAuthorityKinds.PendingOpen,
  );
  assert.equal(pendingModel.textRequestId, 1);
  assert.equal(message.type, "text-open-result");
  assert.equal(message.result.kind, results.WorkspaceTextResultKinds.Opened);
  assert.deepEqual(openedBuffers, [
    {
      bufferKey: filePath,
      initialText: "hello\nworld",
      projectionPath: filePath,
      atMs: 123,
    },
  ]);
  assert.deepEqual(observedBuffers, [
    {
      bufferId: "buffer:notes",
      aperture: {
        cursorLine: 0,
        viewportLineCount: 24,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: 1048576,
      },
      atMs: 123,
    },
  ]);

  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [openedModel] = runtime.update(message, pendingModel);

  assert.equal(
    openedModel.textAuthority.kind,
    authority.WorkspaceTextAuthorityKinds.Opened,
  );
  assert.equal(openedModel.textAuthority.bufferId, "buffer:notes");
  assert.equal(openedModel.textAuthority.cache.readingId, "reading:notes");
  assert.deepEqual(openedModel.editor.lines, ["hello", "world"]);
  assert.equal(openedModel.editor.dirty, false);
  assert.equal(openedModel.editor.readOnly, false);
});

test("viewer renders production text from reading cache instead of stale editor lines", async () => {
  const [viewerContent, modeModule, authority, profile] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "text-runtime-profile.js"),
  ]);
  const model = {
    editor: {
      path: "/repo/notes.txt",
      lines: ["stale local line"],
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
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: false,
      cache: {
        bufferId: "buffer:notes",
        readingId: "reading:fresh",
        lines: ["fresh Echo reading"],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
    viewMode: "source",
    sourceHighlight: undefined,
    time: 0,
    jeditTheme: mockJeditTheme(),
    titleCamera: {
      angle: 0,
      angleTarget: 0,
      angleMotionId: 0,
      radius: 0,
      radiusTarget: 0,
      radiusMotionId: 0,
      position: [0, 2.65, 0],
      target: [0, 0.78, 0],
      eyeY: 2.65,
    },
    titleSceneSeed: 0,
    titleMeshes: {},
    sceneOverride: undefined,
    titleRenderMode: "braille",
    titleAsciiPalette: "dense",
  };

  const surface = viewerContent.renderViewer(model, 80, 16);
  const text = surfaceText(surface);

  assert.match(text, /fresh Echo reading/);
  assert.doesNotMatch(text, /stale local line/);
});

test("insert and delete keys submit production text edits with optimistic local projection", async () => {
  const [viewerKey, runtimeModule, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "viewer-key.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const edits = [];
  const observed = [];
  const productionTextSession = {
    insertText: async (request) => {
      edits.push(["insert", request]);
      return { kind: "applied", result: { receiptId: "receipt:insert" } };
    },
    deleteRange: async (request) => {
      edits.push(["delete", request]);
      return { kind: "applied", result: { receiptId: "receipt:delete" } };
    },
    observeWindow: async (request) => {
      observed.push(request);
      return {
        kind: "observed",
        observed: {
          value: {
            readingId: `reading:${observed.length}`,
            lines: [{ text: editReadingText(observed.length) }],
            lineCount: 1,
            cursorLine: 0,
            viewportLineCount: 24,
            truncated: false,
          },
        },
      };
    },
  };
  const baseModel = textWorkspaceModel(modeModule, authority, profile, {
    mode: modeModule.EditorModes.Insert,
    lines: ["abc"],
    cursorCol: 1,
  });

  const [pendingInsert, insertCommands] = viewerKey.updateViewerFromKey(
    { key: "X", ctrl: false, alt: false, shift: true },
    baseModel,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  assert.deepEqual(pendingInsert.editor.lines, ["aXbc"]);
  assert.equal(pendingInsert.editor.cursorCol, 2);
  assert.equal(pendingInsert.textAuthority.dirty, true);

  const insertMessage = await insertCommands[0]();
  assert.equal(
    insertMessage.result.wscSettlementEnvelope.envelopeId.length,
    64,
  );
  assert.deepEqual(
    Array.from(insertMessage.result.wscSettlementEnvelope.bytes).slice(0, 1),
    [123],
  );
  const settlementWrites = [];
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({
      productionTextSession,
      wscWorkspaceStore: {
        writeEnvelope: (envelope) => {
          settlementWrites.push(envelope);
          return {
            status: "JEDIT_WSC_WORKSPACE_STORE_WRITTEN",
            envelopeId: envelope.envelopeId,
            byteLength: envelope.bytes.byteLength,
            workspacePath: "/repo/.jedit/echo-wsc/envelopes",
          };
        },
        readEnvelope: () => ({
          status: "JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED",
          obstruction: {
            code: "missing_envelope",
            message: "missing envelope",
          },
        }),
        listEnvelopes: () => ({
          status: "JEDIT_WSC_WORKSPACE_STORE_LISTED",
          envelopeIds: [],
          workspacePath: "/repo/.jedit/echo-wsc/envelopes",
        }),
      },
    }),
  );
  const [insertedModel] = runtime.update(insertMessage, pendingInsert);

  assert.deepEqual(baseModel.editor.lines, ["abc"]);
  assert.deepEqual(edits[0], [
    "insert",
    {
      bufferId: "buffer:notes",
      startByte: 1,
      insertText: "X",
      atMs: 12,
    },
  ]);
  assert.deepEqual(settlementWrites, [
    insertMessage.result.wscSettlementEnvelope,
  ]);
  assert.deepEqual(insertedModel.editor.lines, ["aXbc"]);
  assert.equal(insertedModel.textAuthority.lastReceiptId, "receipt:insert");

  const normalModel = {
    ...insertedModel,
    editor: {
      ...insertedModel.editor,
      mode: modeModule.EditorModes.Normal,
      cursorCol: 1,
    },
  };
  const [pendingDelete, deleteCommands] = viewerKey.updateViewerFromKey(
    { key: "x", ctrl: false, alt: false, shift: false },
    normalModel,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  assert.deepEqual(pendingDelete.editor.lines, ["abc"]);
  assert.equal(pendingDelete.textAuthority.dirty, true);

  const deleteMessage = await deleteCommands[0]();
  const [deletedModel] = runtime.update(deleteMessage, pendingDelete);

  assert.deepEqual(edits[1], [
    "delete",
    {
      bufferId: "buffer:notes",
      startByte: 1,
      endByte: 2,
      atMs: 12,
    },
  ]);
  assert.deepEqual(deletedModel.editor.lines, ["abc"]);
  assert.equal(deletedModel.textAuthority.lastReceiptId, "receipt:delete");

  const backspaceModel = {
    ...deletedModel,
    editor: {
      ...deletedModel.editor,
      mode: modeModule.EditorModes.Insert,
      cursorCol: 1,
    },
  };
  const [pendingBackspace, backspaceCommands] = viewerKey.updateViewerFromKey(
    { key: "backspace", ctrl: false, alt: false, shift: false },
    backspaceModel,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  assert.deepEqual(pendingBackspace.editor.lines, ["bc"]);

  const backspaceMessage = await backspaceCommands[0]();
  const [backspacedModel] = runtime.update(backspaceMessage, pendingBackspace);

  assert.deepEqual(edits[2], [
    "delete",
    {
      bufferId: "buffer:notes",
      startByte: 0,
      endByte: 1,
      atMs: 12,
    },
  ]);
  assert.deepEqual(backspacedModel.editor.lines, ["bc"]);
});

test("normal mode dd submits a production line delete edit", async () => {
  const [viewerKey, runtimeModule, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "viewer-key.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const deletes = [];
  const productionTextSession = {
    deleteRange: async (request) => {
      deletes.push(request);
      return { kind: "applied", result: { receiptId: "receipt:dd" } };
    },
    observeWindow: async () => ({
      kind: "observed",
      observed: {
        value: {
          readingId: "reading:dd",
          lines: [{ text: "one" }, { text: "three" }],
          lineCount: 2,
          cursorLine: 1,
          viewportLineCount: 24,
          truncated: false,
        },
      },
    }),
  };
  const model = textWorkspaceModel(modeModule, authority, profile, {
    lines: ["one", "two", "three"],
    cursorRow: 1,
    cursorCol: 1,
  });
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );

  const [pendingDelete, pendingCommands] = viewerKey.updateViewerFromKey(
    { key: "d", ctrl: false, alt: false, shift: false },
    model,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  const [queuedDelete, deleteCommands] = viewerKey.updateViewerFromKey(
    { key: "d", ctrl: false, alt: false, shift: false },
    pendingDelete,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  const deleteMessage = await deleteCommands[0]();
  const [deletedModel] = runtime.update(deleteMessage, queuedDelete);

  assert.equal(pendingCommands.length, 0);
  assert.deepEqual(deletes, [
    {
      bufferId: "buffer:notes",
      startByte: 4,
      endByte: 8,
      atMs: 12,
    },
  ]);
  assert.deepEqual(deletedModel.editor.lines, ["one", "three"]);
  assert.equal(deletedModel.editor.mode, modeModule.EditorModes.Normal);
  assert.equal(deletedModel.editor.cursorRow, 1);
  assert.equal(deletedModel.editor.cursorCol, 0);
});

test("normal mode cw submits a production change edit and enters insert mode", async () => {
  const [viewerKey, runtimeModule, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "viewer-key.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const replacements = [];
  const productionTextSession = {
    replaceRange: async (request) => {
      replacements.push(request);
      return { kind: "applied", result: { receiptId: "receipt:cw" } };
    },
    observeWindow: async () => ({
      kind: "observed",
      observed: {
        value: {
          readingId: "reading:cw",
          lines: [{ text: "beta" }],
          lineCount: 1,
          cursorLine: 0,
          viewportLineCount: 24,
          truncated: false,
        },
      },
    }),
  };
  const model = textWorkspaceModel(modeModule, authority, profile, {
    lines: ["alpha beta"],
    cursorCol: 0,
  });
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );

  const [pendingChange] = viewerKey.updateViewerFromKey(
    { key: "c", ctrl: false, alt: false, shift: false },
    model,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  const [queuedChange, changeCommands] = viewerKey.updateViewerFromKey(
    { key: "w", ctrl: false, alt: false, shift: false },
    pendingChange,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  const changeMessage = await changeCommands[0]();
  const [changedModel] = runtime.update(changeMessage, queuedChange);

  assert.deepEqual(replacements, [
    {
      bufferId: "buffer:notes",
      startByte: 0,
      endByte: 6,
      insertText: "",
      atMs: 12,
    },
  ]);
  assert.deepEqual(changedModel.editor.lines, ["beta"]);
  assert.equal(changedModel.editor.mode, modeModule.EditorModes.Insert);
  assert.equal(changedModel.editor.cursorCol, 0);
});

function editReadingText(index) {
  if (index === 1) {
    return "aXbc";
  }
  if (index === 2) {
    return "abc";
  }
  return "bc";
}

test("cursor movement on production text changes UI only and does not submit edits", async () => {
  const [viewerKey, modeModule, authority, profile] = await Promise.all([
    importDist("app", "workspace", "viewer-key.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "text-runtime-profile.js"),
  ]);
  const productionTextSession = {
    insertText: async () => {
      throw new Error("movement must not submit insert");
    },
    deleteRange: async () => {
      throw new Error("movement must not submit delete");
    },
  };
  const model = textWorkspaceModel(modeModule, authority, profile, {
    mode: modeModule.EditorModes.Normal,
    lines: ["abc"],
    cursorCol: 0,
  });

  const [nextModel, commands] = viewerKey.updateViewerFromKey(
    { key: "l", ctrl: false, alt: false, shift: false },
    model,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );

  assert.equal(nextModel.editor.cursorCol, 1);
  assert.deepEqual(nextModel.editor.lines, ["abc"]);
  assert.equal(commands.length, 0);
});

test("viewport movement requests a bounded read without submitting edits", async () => {
  const [viewerKey, runtimeModule, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "viewer-key.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const observed = [];
  const productionTextSession = {
    deleteRange: async () => {
      throw new Error("viewport movement must not submit delete");
    },
    observeWindow: async (request) => {
      observed.push(request);
      return {
        kind: "observed",
        observed: {
          value: {
            readingId: "reading:viewport",
            lines: [{ text: "line after viewport move" }],
            lineCount: 1,
            cursorLine: 0,
            viewportLineCount: 24,
            truncated: false,
          },
        },
      };
    },
  };
  const model = textWorkspaceModel(modeModule, authority, profile, {
    mode: modeModule.EditorModes.Normal,
    lines: Array.from({ length: 40 }, (_, index) => `line ${index}`),
    cursorRow: 0,
    cursorCol: 0,
  });

  const [pendingRead, commands] = viewerKey.updateViewerFromKey(
    { key: "pagedown", ctrl: false, alt: false, shift: false },
    {
      ...model,
      rows: 8,
    },
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  const message = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [readModel] = runtime.update(message, pendingRead);

  assert.equal(commands.length, 1);
  assert.deepEqual(observed, [
    {
      bufferId: "buffer:notes",
      aperture: {
        cursorLine: 0,
        viewportLineCount: 24,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: 1048576,
      },
      atMs: 12,
    },
  ]);
  assert.deepEqual(readModel.editor.lines, ["line after viewport move"]);
});

test("ctrl-s exports production text and checkpoints without direct local save first", async () => {
  const [keyBindings, runtimeModule, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "key-bindings.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const savedFiles = [];
  const exportCalls = [];
  const documentLines = Array.from(
    { length: 30 },
    (_, index) => `line ${index}`,
  );
  const productionTextSession = {
    exportWindow: async (request) => {
      exportCalls.push(request);
      return {
        kind: "exported",
        text: documentLines
          .slice(0, request.aperture.viewportLineCount)
          .join("\n"),
        readingId: "reading:export",
      };
    },
    checkpointBuffer: async () => ({
      kind: "checkpointed",
      result: {
        checkpointId: "checkpoint:save",
      },
    }),
  };
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      lines: ["stale"],
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      hostFingerprint: HOST_FINGERPRINT_A,
      cache: {
        bufferId: "buffer:notes",
        readingId: "reading:dirty",
        lines: ["stale"],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
  };
  const context = {
    ...mockKeyBindingContext(),
    nowMs: () => 99,
    deps: mockDeps({
      editorFile: {
        loadEditorFile: () => ({
          lines: ["stale"],
          readOnly: false,
          fingerprint: HOST_FINGERPRINT_A,
        }),
        saveEditorFile: (filePath, lines) => {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession,
    }),
  };

  const [pendingSave, commands] = keyBindings.updateFromKey(
    { key: "s", ctrl: true, alt: false, shift: false },
    model,
    context,
  );
  assert.equal(commands.length, 1);
  const exportMessage = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [exportedModel, checkpointCommands] = runtime.update(
    exportMessage,
    pendingSave,
  );
  assert.equal(checkpointCommands.length, 1);
  const checkpointMessage = await checkpointCommands[0]();
  const [checkpointedModel] = runtime.update(checkpointMessage, exportedModel);

  assert.deepEqual(exportCalls, [
    {
      bufferId: "buffer:notes",
      aperture: {
        cursorLine: 0,
        viewportLineCount: Number.MAX_SAFE_INTEGER,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: Number.MAX_SAFE_INTEGER,
      },
      atMs: 99,
    },
  ]);
  assert.deepEqual(savedFiles, [
    { filePath: "/repo/notes.txt", lines: documentLines },
  ]);
  assert.equal(
    checkpointedModel.textAuthority.lastExportReadingId,
    "reading:export",
  );
  assert.equal(
    checkpointedModel.textAuthority.lastCheckpointId,
    "checkpoint:save",
  );
  assert.equal(checkpointedModel.textAuthority.hostBasis, "file");
  assert.equal(checkpointedModel.textAuthority.materialization, "materialized");
  assert.equal(checkpointedModel.textAuthority.hostFingerprint.algorithm, "sha256");
  assert.equal(checkpointedModel.editor.dirty, false);
});

for (const blockCase of EXISTING_SAVE_BLOCK_CASES) {
  test(`ctrl-s blocks materialization when ${blockCase.title}`, async () => {
    const [keyBindings, runtimeModule, modeModule, authority, profile] =
      await Promise.all([
        importDist("app", "workspace", "key-bindings.js"),
        importDist("app", "workspace", "runtime.js"),
        importDist("app", "workspace", "editor", "mode.js"),
        importDist("app", "workspace", "workspace-text-authority.js"),
        importDist("app", "text-runtime-profile.js"),
      ]);
    const savedFiles = [];
    const loadedFiles = [];
    const exportCalls = [];
    const checkpointCalls = [];
    const filePath = "/repo/notes.txt";
    const productionTextSession = {
      exportWindow: async (request) => {
        exportCalls.push(request);
        return {
          kind: "exported",
          text: "local draft",
          readingId: "reading:export",
        };
      },
      checkpointBuffer: async (request) => {
        checkpointCalls.push(request);
        return {
          kind: "checkpointed",
          result: {
            checkpointId: "checkpoint:save",
          },
        };
      },
    };
    const model = {
      ...textWorkspaceModel(modeModule, authority, profile, {
        dirty: true,
        lines: ["local draft"],
      }),
      textAuthority: authority.openedWorkspaceTextAuthority({
        profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
        filePath,
        bufferId: "buffer:notes",
        readOnly: false,
        dirty: true,
        hostFingerprint: HOST_FINGERPRINT_A,
        cache: {
          bufferId: "buffer:notes",
          readingId: "reading:local",
          lines: ["local draft"],
          lineCount: 1,
          cursorLine: 0,
          viewportLineCount: 24,
          truncated: false,
        },
      }),
    };
    const context = {
      ...mockKeyBindingContext(),
      nowMs: () => 102,
      deps: mockDeps({
        editorFile: {
          loadEditorFile: (loadedPath) => {
            loadedFiles.push(loadedPath);
            return blockCase.observed(loadedPath);
          },
          saveEditorFile: (savedPath, lines) => {
            savedFiles.push({ filePath: savedPath, lines });
          },
        },
        productionTextSession,
      }),
    };

    const [pendingSave, commands] = keyBindings.updateFromKey(
      { key: "s", ctrl: true, alt: false, shift: false },
      model,
      context,
    );
    assert.equal(commands.length, 1);
    const exportMessage = await commands[0]();
    const runtime = runtimeModule.createWorkspaceRuntime(
      mockRuntime({ productionTextSession }),
    );
    const [blockedModel] = runtime.update(exportMessage, pendingSave);

    assert.deepEqual(loadedFiles, [filePath]);
    assert.deepEqual(exportCalls, []);
    assert.deepEqual(savedFiles, []);
    assert.deepEqual(checkpointCalls, []);
    assert.equal(exportMessage.result.kind, "obstructed");
    assert.match(exportMessage.result.issue.message, blockCase.message);
    assert.equal(blockedModel.textAuthority.dirty, true);
    assert.equal(blockedModel.textAuthority.hostBasis, "file");
    assert.deepEqual(
      blockedModel.textAuthority.hostFingerprint,
      HOST_FINGERPRINT_A,
    );
    assert.equal(blockedModel.textAuthority.materialization, "unmaterialized");
    assert.equal(blockedModel.editor.dirty, true);
  });
}

test("ctrl-s blocks materialization when a missing-open path appeared", async () => {
  const [keyBindings, runtimeModule, modeModule, authority, profile] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "text-runtime-profile.js"),
  ]);
  const savedFiles = [];
  const loadedFiles = [];
  const exportCalls = [];
  const checkpointCalls = [];
  const productionTextSession = {
    exportWindow: async (request) => {
      exportCalls.push(request);
      return {
        kind: "exported",
        text: "local draft",
        readingId: "reading:export",
      };
    },
    checkpointBuffer: async (request) => {
      checkpointCalls.push(request);
      return {
        kind: "checkpointed",
        result: {
          checkpointId: "checkpoint:save",
        },
      };
    },
  };
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      lines: ["local draft"],
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/new.txt",
      bufferId: "buffer:new",
      readOnly: false,
      dirty: true,
      materialization: "unmaterialized",
      hostBasis: "missing",
      cache: {
        bufferId: "buffer:new",
        readingId: "reading:local",
        lines: ["local draft"],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
  };
  const context = {
    ...mockKeyBindingContext(),
    nowMs: () => 100,
    deps: mockDeps({
      editorFile: {
        loadEditorFile: (filePath) => {
          loadedFiles.push(filePath);
          return { lines: ["external"], readOnly: false };
        },
        saveEditorFile: (filePath, lines) => {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession,
    }),
  };

  const [pendingSave, commands] = keyBindings.updateFromKey(
    { key: "s", ctrl: true, alt: false, shift: false },
    model,
    context,
  );
  assert.equal(commands.length, 1);
  const exportMessage = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [blockedModel] = runtime.update(exportMessage, pendingSave);

  assert.deepEqual(exportCalls, []);
  assert.deepEqual(loadedFiles, ["/repo/new.txt"]);
  assert.equal(exportMessage.result.kind, "obstructed");
  assert.match(exportMessage.result.issue.message, /appeared on disk after open/);
  assert.deepEqual(savedFiles, []);
  assert.deepEqual(checkpointCalls, []);
  assert.equal(blockedModel.textAuthority.dirty, true);
  assert.equal(blockedModel.textAuthority.materialization, "unmaterialized");
  assert.equal(blockedModel.editor.dirty, true);
});

test("ctrl-s materializes a missing-open path when it is still absent", async () => {
  const [keyBindings, runtimeModule, modeModule, authority, profile] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "text-runtime-profile.js"),
  ]);
  const savedFiles = [];
  const loadedFiles = [];
  const productionTextSession = {
    exportWindow: async () => ({
      kind: "exported",
      text: "local draft",
      readingId: "reading:export",
    }),
    checkpointBuffer: async () => ({
      kind: "checkpointed",
      result: {
        checkpointId: "checkpoint:save",
      },
    }),
  };
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      lines: ["local draft"],
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/new.txt",
      bufferId: "buffer:new",
      readOnly: false,
      dirty: true,
      materialization: "unmaterialized",
      hostBasis: "missing",
      cache: {
        bufferId: "buffer:new",
        readingId: "reading:local",
        lines: ["local draft"],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
  };
  const context = {
    ...mockKeyBindingContext(),
    nowMs: () => 101,
    deps: mockDeps({
      editorFile: {
        loadEditorFile: (filePath) => {
          loadedFiles.push(filePath);
          return { kind: "missing", filePath };
        },
        saveEditorFile: (filePath, lines) => {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession,
    }),
  };

  const [pendingSave, commands] = keyBindings.updateFromKey(
    { key: "s", ctrl: true, alt: false, shift: false },
    model,
    context,
  );
  assert.equal(commands.length, 1);
  const exportMessage = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [exportedModel, checkpointCommands] = runtime.update(
    exportMessage,
    pendingSave,
  );
  assert.equal(checkpointCommands.length, 1);
  const checkpointMessage = await checkpointCommands[0]();
  const [checkpointedModel] = runtime.update(checkpointMessage, exportedModel);

  assert.deepEqual(loadedFiles, ["/repo/new.txt"]);
  assert.deepEqual(savedFiles, [
    { filePath: "/repo/new.txt", lines: ["local draft"] },
  ]);
  assert.equal(checkpointedModel.textAuthority.hostBasis, "file");
  assert.equal(checkpointedModel.textAuthority.materialization, "materialized");
  assert.equal(checkpointedModel.editor.dirty, false);
});

function textWorkspaceModel(modeModule, authority, profile, editorOverrides) {
  return {
    editor: {
      path: "/repo/notes.txt",
      lines: ["abc"],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: false,
      mode: modeModule.EditorModes.Normal,
      undoStack: [],
      redoStack: [],
      ...editorOverrides,
    },
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: false,
      cache: {
        bufferId: "buffer:notes",
        readingId: "reading:initial",
        lines: ["abc"],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
    textRuntimeProfile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    textRequestId: 0,
    time: 12,
    focusPane: "editor",
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    historyDrawerProgress: 0,
    echoHistory: [],
    echoHistorySelectedIndex: 0,
    graftInfo: undefined,
    graftLoading: false,
    graftRequestId: 0,
    graftSelectedIndex: 0,
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
    sourceHighlightRequestId: 0,
    columns: 80,
    rows: 24,
    viewMode: "source",
    notifications: createNotificationState(),
    notificationLoopActive: false,
    workspaceRoot: "/repo",
    cwd: "/repo",
    entries: [],
    selectedIndex: 0,
  };
}
