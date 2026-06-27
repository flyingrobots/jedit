import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationState } from "@flyingrobots/bijou-tui";
import {
  importDist,
  fakeProductionTextSession,
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

test("opening a long file does not truncate editor projection to the first window", async () => {
  const [initModule, fileTree, fileSystem, runtimeModule, authority] =
    await Promise.all([
      importDist("app", "workspace", "init.js"),
      importDist("app", "workspace", "file-tree.js"),
      importDist("ports", "file-system.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
    ]);
  const filePath = "/repo/long.txt";
  const hostLines = Array.from({ length: 40 }, (_, index) => `line ${index}`);
  const productionTextSession = {
    openBuffer: async () => ({
      kind: "opened",
      optic: {
        buffer: {
          bufferId: "buffer:long",
        },
      },
    }),
    observeWindow: async () => ({
      kind: "observed",
      observed: {
        value: textWindowReading({
          readingId: "reading:long",
          lines: hostLines.slice(0, 24),
          totalLineCount: hostLines.length,
        }),
      },
    }),
  };
  const model = initModule.createInitialModel("/repo", 120, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "long.txt",
        path: filePath,
      },
    ],
    nowMs: 100,
  });

  const [pendingModel, commands] = fileTree.updateTreeFromKey(
    { key: "enter" },
    model,
    () => 123,
    mockDeps({
      editorFile: {
        loadEditorFile: () => ({ lines: hostLines, readOnly: false }),
        saveEditorFile: () => undefined,
      },
      productionTextSession,
    }),
  );
  const message = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [openedModel] = runtime.update(message, pendingModel);

  assert.equal(
    openedModel.textAuthority.kind,
    authority.WorkspaceTextAuthorityKinds.Opened,
  );
  assert.equal(openedModel.textAuthority.cache.coverage, "window");
  assert.deepEqual(openedModel.editor.lines, hostLines);
});

test("viewer renders production text from full reading cache instead of stale editor lines", async () => {
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
      cache: workspaceReadingCache({
        bufferId: "buffer:notes",
        readingId: "reading:fresh",
        lines: ["fresh Echo reading"],
      }),
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
      const startLine = request.aperture.cursorLine;
      return {
        kind: "observed",
        observed: {
          value: {
            readingId: "reading:viewport",
            lines: [{
              lineNumber: startLine,
              startByte: startLine * 8,
              endByte: startLine * 8 + 24,
              text: "line after viewport move",
            }],
            startLine,
            lineCount: 1,
            totalLineCount: 40,
            hasMoreBefore: startLine > 0,
            hasMoreAfter: true,
            cursorLine: startLine,
            viewportLineCount: request.aperture.viewportLineCount,
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
        cursorLine: pendingRead.editor.scrollRow,
        viewportLineCount: 4,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: 1048576,
      },
      atMs: 12,
    },
  ]);
  assert.equal(readModel.textAuthority.cache.coverage, "window");
  assert.equal(readModel.textAuthority.cache.startLine, pendingRead.editor.scrollRow);
  assert.deepEqual(readModel.editor.lines, model.editor.lines);
});

test("bounded TextReadResult preserves dirty local editor projection", async () => {
  const [runtimeModule, modeModule, authority, profile, msgModule, results] =
    await Promise.all([
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  const localLines = Array.from({ length: 50 }, (_, index) => `local ${index}`);
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      mode: modeModule.EditorModes.Insert,
      lines: localLines,
      cursorRow: 40,
      scrollRow: 24,
    }),
    textRequestId: 5,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      cache: workspaceReadingCache({ lines: localLines }),
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const [readModel] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextReadResult,
    requestId: 5,
    result: {
      kind: results.WorkspaceTextResultKinds.Read,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      cache: workspaceReadingCache({
        readingId: "reading:bounded",
        lines: ["window 24"],
        startLine: 24,
        returnedLineCount: 1,
        totalLineCount: localLines.length,
        hasMoreBefore: true,
        hasMoreAfter: true,
      }),
    },
  }, model);

  assert.equal(readModel.textAuthority.cache.coverage, "window");
  assert.deepEqual(readModel.editor.lines, localLines);
  assert.equal(readModel.editor.cursorRow, 40);
  assert.equal(readModel.editor.dirty, true);
});

test("bounded TextEditResult preserves dirty local editor projection", async () => {
  const [runtimeModule, modeModule, authority, profile, msgModule, results] =
    await Promise.all([
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  const localLines = Array.from({ length: 50 }, (_, index) => `local ${index}`);
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      mode: modeModule.EditorModes.Insert,
      lines: localLines,
      cursorRow: 39,
      cursorCol: 3,
      scrollRow: 24,
    }),
    textRequestId: 8,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      cache: workspaceReadingCache({ lines: localLines }),
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const [editModel] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 8,
    result: {
      kind: results.WorkspaceTextResultKinds.Applied,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      receiptId: "receipt:bounded",
      cursorAfter: { row: 40, column: 1 },
      cache: workspaceReadingCache({
        readingId: "reading:bounded-edit",
        lines: ["window 24"],
        startLine: 24,
        returnedLineCount: 1,
        totalLineCount: localLines.length,
        hasMoreBefore: true,
        hasMoreAfter: true,
      }),
    },
  }, model);

  assert.equal(editModel.textAuthority.cache.coverage, "window");
  assert.deepEqual(editModel.editor.lines, localLines);
  assert.equal(editModel.editor.cursorRow, 40);
  assert.equal(editModel.editor.cursorCol, 1);
  assert.equal(editModel.editor.dirty, true);
});

test("TextEditResult for an inactive buffer is ignored even when request id matches", async () => {
  const [runtimeModule, modeModule, authority, profile, msgModule, results] =
    await Promise.all([
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      path: "/repo/b.txt",
      lines: ["buffer b local"],
      dirty: true,
    }),
    textRequestId: 9,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/b.txt",
      bufferId: "buffer:b",
      readOnly: false,
      dirty: true,
      cache: workspaceReadingCache({
        bufferId: "buffer:b",
        readingId: "reading:b",
        lines: ["buffer b local"],
      }),
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const [nextModel] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 9,
    result: {
      kind: results.WorkspaceTextResultKinds.Applied,
      filePath: "/repo/a.txt",
      bufferId: "buffer:a",
      receiptId: "receipt:a",
      cache: workspaceReadingCache({
        bufferId: "buffer:a",
        readingId: "reading:a",
        lines: ["buffer a stale"],
      }),
    },
  }, model);

  assert.equal(nextModel.textAuthority.bufferId, "buffer:b");
  assert.equal(nextModel.textAuthority.lastReceiptId, undefined);
  assert.deepEqual(nextModel.editor.lines, ["buffer b local"]);
  assert.deepEqual(nextModel.echoHistory, []);
});

test("dependent TextEditResult stays blocked after an earlier obstruction", async () => {
  const [runtimeModule, modeModule, authority, profile, msgModule, results] =
    await Promise.all([
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  const localLines = ["ab"];
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      mode: modeModule.EditorModes.Insert,
      lines: localLines,
      cursorRow: 0,
      cursorCol: 2,
    }),
    textRequestId: 2,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      pendingClientSeq: 2,
      pendingIntentStatus: authority.WorkspaceTextIntentStatuses.Predicted,
      cache: workspaceReadingCache({ lines: [""] }),
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    nowMs: () => 55,
  }));
  const [obstructedModel] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 1,
    result: {
      kind: results.WorkspaceTextResultKinds.Obstructed,
      filePath: "/repo/notes.txt",
      issue: {
        message: "footprint changed",
        level: "error",
        source: "command",
        atMs: 54,
      },
    },
  }, model);
  const [blockedModel] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 2,
    result: {
      kind: results.WorkspaceTextResultKinds.Applied,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      receiptId: "receipt:dependent",
      cursorAfter: { row: 0, column: 2 },
      cache: workspaceReadingCache({
        readingId: "reading:dependent",
        lines: ["ab"],
      }),
    },
  }, obstructedModel);

  assert.deepEqual(blockedModel.editor.lines, localLines);
  assert.equal(blockedModel.textAuthority.pendingIntentStatus, authority.WorkspaceTextIntentStatuses.Blocked);
  assert.equal(blockedModel.textAuthority.blockedByClientSeq, 1);
  assert.equal(blockedModel.textAuthority.lastReceiptId, undefined);
  assert.equal(blockedModel.echoHistory.at(-2).status, "obstructed");
  assert.equal(blockedModel.echoHistory.at(-1).status, "blocked");
  assert.match(blockedModel.echoHistory.at(-1).summary, /request:1/);
});

test("stale TextEditResult obstruction is ignored after a newer edit settles", async () => {
  const [runtimeModule, modeModule, authority, profile, msgModule, results] =
    await Promise.all([
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      mode: modeModule.EditorModes.Insert,
      lines: ["ab"],
      cursorRow: 0,
      cursorCol: 2,
    }),
    textRequestId: 2,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      pendingClientSeq: 2,
      pendingReceiptId: "receipt:2",
      pendingIntentStatus: authority.WorkspaceTextIntentStatuses.Admitted,
      lastReceiptId: "receipt:2",
      cache: workspaceReadingCache({ lines: ["ab"] }),
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const [nextModel] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 1,
    result: {
      kind: results.WorkspaceTextResultKinds.Obstructed,
      filePath: "/repo/notes.txt",
      issue: {
        message: "late obstruction",
        level: "error",
        source: "command",
        atMs: 60,
      },
    },
  }, model);

  assert.equal(nextModel.textAuthority.pendingIntentStatus, authority.WorkspaceTextIntentStatuses.Admitted);
  assert.equal(nextModel.textAuthority.lastObstruction, undefined);
  assert.equal(nextModel.textAuthority.blockedByClientSeq, undefined);
  assert.equal(nextModel.textAuthority.lastReceiptId, "receipt:2");
  assert.deepEqual(nextModel.echoHistory, []);
});

test("save blocks while a production text intent is still pending", async () => {
  const [saveKey, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "workspace-save-key.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const exportCalls = [];
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      lines: ["optimistic local"],
    }),
    textRequestId: 4,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      pendingClientSeq: 4,
      pendingIntentStatus: authority.WorkspaceTextIntentStatuses.Predicted,
      cache: workspaceReadingCache({ lines: ["base"] }),
    }),
  };
  const context = mockKeyBindingContext({
    nowMs: () => 77,
    deps: {
      productionTextSession: fakeProductionTextSession({
        exportSnapshot: async (request) => {
          exportCalls.push(request);
          return {
            kind: "exported",
            text: "base",
            readingId: "reading:base",
          };
        },
      }),
    },
  });

  const [blockedModel, commands] = saveKey.saveWorkspace(model, context);

  assert.equal(blockedModel.textRequestId, 4);
  assert.equal(blockedModel.textAuthority.pendingIntentStatus, authority.WorkspaceTextIntentStatuses.Predicted);
  assert.equal(exportCalls.length, 0);
  assert.equal(commands.length, 1);
});

test("edit planning after bounded read uses the full local projection", async () => {
  const [viewerKey, modeModule, authority, profile] =
    await Promise.all([
      importDist("app", "workspace", "viewer-key.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
    ]);
  const inserts = [];
  const localLines = Array.from({ length: 50 }, (_, index) => `local ${index}`);
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      mode: modeModule.EditorModes.Insert,
      lines: localLines,
      cursorRow: 30,
      cursorCol: 0,
      scrollRow: 24,
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      cache: workspaceReadingCache({
        readingId: "reading:bounded",
        lines: ["window 24"],
        startLine: 24,
        returnedLineCount: 1,
        totalLineCount: localLines.length,
        hasMoreBefore: true,
        hasMoreAfter: true,
      }),
    }),
  };
  const productionTextSession = {
    insertText: async (request) => {
      inserts.push(request);
      return { kind: "applied", result: { receiptId: "receipt:insert" } };
    },
    observeWindow: async () => ({
      kind: "observed",
      observed: {
        value: textWindowReading({
          readingId: "reading:after-insert",
          lines: ["window 24"],
          startLine: 24,
          totalLineCount: localLines.length,
        }),
      },
    }),
  };

  const [, commands] = viewerKey.updateViewerFromKey(
    { key: "Z", ctrl: false, alt: false, shift: true },
    model,
    mockDeps().sourceHighlighter,
    productionTextSession,
  );
  await commands[0]();

  assert.equal(inserts[0].startByte, byteOffsetAtLine(localLines, 30));
  assert.equal(inserts[0].insertText, "Z");
});

test("ctrl-s exports a full production snapshot and checkpoints without direct local save first", async () => {
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
    exportSnapshot: async (request) => {
      exportCalls.push(request);
      return {
        kind: "exported",
        text: documentLines.join("\n"),
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
      exportSnapshot: async (request) => {
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
    assert.deepEqual(exportCalls, [{ bufferId: "buffer:notes", atMs: 102 }]);
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
    exportSnapshot: async (request) => {
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

  assert.deepEqual(exportCalls, [{ bufferId: "buffer:new", atMs: 100 }]);
  assert.deepEqual(loadedFiles, ["/repo/new.txt"]);
  assert.equal(exportMessage.result.kind, "obstructed");
  assert.match(exportMessage.result.issue.message, /appeared on disk after open/);
  assert.deepEqual(savedFiles, []);
  assert.deepEqual(checkpointCalls, []);
  assert.equal(blockedModel.textAuthority.dirty, true);
  assert.equal(blockedModel.textAuthority.materialization, "unmaterialized");
  assert.equal(blockedModel.editor.dirty, true);
});

test("ctrl-s blocks without saving when full snapshot export obstructs", async () => {
  const [keyBindings, runtimeModule, modeModule, authority, profile] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "text-runtime-profile.js"),
  ]);
  const savedFiles = [];
  const loadedFiles = [];
  const checkpointCalls = [];
  const productionTextSession = {
    exportSnapshot: async () => ({
      kind: "obstructed",
      obstruction: {
        code: "text-buffer-export-obstructed",
        issue: {
          message: "Text export requires a full untruncated text snapshot.",
          level: "error",
          source: "command",
          atMs: 103,
        },
      },
    }),
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
      filePath: "/repo/notes.txt",
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
    nowMs: () => 103,
    deps: mockDeps({
      editorFile: {
        loadEditorFile: (filePath) => {
          loadedFiles.push(filePath);
          return {
            lines: ["local draft"],
            readOnly: false,
            fingerprint: HOST_FINGERPRINT_A,
          };
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

  assert.deepEqual(loadedFiles, []);
  assert.deepEqual(savedFiles, []);
  assert.deepEqual(checkpointCalls, []);
  assert.equal(exportMessage.result.kind, "obstructed");
  assert.match(exportMessage.result.issue.message, /full untruncated text snapshot/);
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
    exportSnapshot: async () => ({
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
      cache: workspaceReadingCache({
        bufferId: "buffer:notes",
        readingId: "reading:initial",
        lines: ["abc"],
      }),
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

function workspaceReadingCache(overrides = {}) {
  const lines = overrides.lines ?? ["abc"];
  const startLine = overrides.startLine ?? 0;
  const returnedLineCount = overrides.returnedLineCount ?? lines.length;
  const totalLineCount = overrides.totalLineCount ?? lines.length;
  const truncated = overrides.truncated ?? false;
  const hasMoreBefore = overrides.hasMoreBefore ?? startLine > 0;
  const hasMoreAfter = overrides.hasMoreAfter ?? startLine + returnedLineCount < totalLineCount;
  const coverage = overrides.coverage
    ?? (
      startLine === 0 &&
      hasMoreBefore !== true &&
      hasMoreAfter !== true &&
      truncated !== true &&
      returnedLineCount === totalLineCount
        ? "full"
        : "window"
    );
  return {
    bufferId: "buffer:notes",
    readingId: "reading:test",
    lines,
    coverage,
    lineCount: totalLineCount,
    startLine,
    returnedLineCount,
    totalLineCount,
    hasMoreBefore,
    hasMoreAfter,
    cursorLine: startLine,
    viewportLineCount: 24,
    truncated,
    ...overrides,
  };
}

function textWindowReading(options) {
  const startLine = options.startLine ?? 0;
  const lines = options.lines ?? ["abc"];
  const totalLineCount = options.totalLineCount ?? lines.length;
  return {
    readingId: options.readingId ?? "reading:test",
    lines: lines.map((text, index) => ({
      lineNumber: startLine + index,
      startByte: byteOffsetAtLine(lines, index),
      endByte: byteOffsetAtLine(lines, index) + text.length,
      text,
    })),
    startLine,
    lineCount: lines.length,
    totalLineCount,
    hasMoreBefore: startLine > 0,
    hasMoreAfter: startLine + lines.length < totalLineCount,
    cursorLine: startLine,
    viewportLineCount: lines.length,
    truncated: false,
  };
}

function byteOffsetAtLine(lines, targetLine) {
  let offset = 0;
  for (let line = 0; line < targetLine; line += 1) {
    offset += (lines[line] ?? "").length + 1;
  }
  return offset;
}
