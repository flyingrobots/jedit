import assert from "node:assert/strict";
import test from "node:test";
import {
  fakeProductionTextSession,
  importDist,
  mockEditor,
  mockI18n,
  mockKeyBindingContext,
  mockRuntime,
  mockTitleScreenModel,
  surfaceText,
} from "./workspace-helpers.mjs";

function byteOffset(value) {
  return { kind: "utf8-byte-offset", value };
}

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

test("colon in normal editor mode enters command-line mode", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: ":", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.commandLine.active, true);
  assert.equal(nextModel.commandLine.input, "");
  assert.equal(nextModel.commandLine.cursorIndex, 0);
  assert.equal(nextModel.commandLine.anchorCursorIndex, 0);
  assert.equal(nextModel.commandLine.selectedCompletionIndex, 0);
  assert.equal(nextModel.editor.mode, editorMode.EditorModes.Normal);
  assert.deepEqual(commands, []);
});

test("colon in title browse mode enters command-line mode", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: undefined,
    focusPane: "editor",
    startupIntroComplete: true,
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: ":", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.commandLine.active, true);
  assert.equal(nextModel.commandLine.input, "");
  assert.equal(nextModel.commandLine.anchorCursorIndex, 0);
  assert.deepEqual(commands, []);
});

test("command-line mode edits printable input and backspace", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const context = mockKeyBindingContext();
  const base = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    commandLine: {
      active: true,
      input: "",
      cursorIndex: 0,
      selectedCompletionIndex: 0,
    },
  });

  const [withE] = keyBindings.updateFromKey(
    { type: "key", key: "e", ctrl: false, alt: false, shift: false },
    base,
    context,
  );
  const [withEd] = keyBindings.updateFromKey(
    { type: "key", key: "d", ctrl: false, alt: false, shift: false },
    withE,
    context,
  );
  const [withSpace] = keyBindings.updateFromKey(
    { type: "key", key: "space", ctrl: false, alt: false, shift: false },
    withEd,
    context,
  );
  const [backspaced, commands] = keyBindings.updateFromKey(
    { type: "key", key: "backspace", ctrl: false, alt: false, shift: false },
    withSpace,
    context,
  );

  assert.equal(withE.commandLine.input, "e");
  assert.equal(withE.commandLine.cursorIndex, 1);
  assert.equal(withEd.commandLine.input, "ed");
  assert.equal(withEd.commandLine.cursorIndex, 2);
  assert.equal(withSpace.commandLine.input, "ed ");
  assert.equal(withSpace.commandLine.cursorIndex, 3);
  assert.equal(backspaced.commandLine.input, "ed");
  assert.equal(backspaced.commandLine.cursorIndex, 2);
  assert.deepEqual(commands, []);
});

test("command-line mode marks unknown command fragments while typing", async () => {
  const [keyBindings, viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const context = mockKeyBindingContext();
  const base = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 12,
    editor: mockEditor(editorMode),
    focusPane: "editor",
    footerVisible: true,
    i18n: commandLineRenderI18n(),
    jeditTheme: commandLineRenderTheme(),
    commandLine: activeCommandLine(""),
  });

  const [withE] = keyBindings.updateFromKey(
    { type: "key", key: "e", ctrl: false, alt: false, shift: false },
    base,
    context,
  );
  const [withEx] = keyBindings.updateFromKey(
    { type: "key", key: "x", ctrl: false, alt: false, shift: false },
    withE,
    context,
  );
  const [withExi] = keyBindings.updateFromKey(
    { type: "key", key: "i", ctrl: false, alt: false, shift: false },
    withEx,
    context,
  );
  const [withExAgain] = keyBindings.updateFromKey(
    { type: "key", key: "backspace", ctrl: false, alt: false, shift: false },
    withExi,
    context,
  );
  const [backToE] = keyBindings.updateFromKey(
    { type: "key", key: "backspace", ctrl: false, alt: false, shift: false },
    withExAgain,
    context,
  );
  const surface = viewer.renderWorkspace(withExi);
  const commandLineRow = withExi.rows - 2;
  const line = surfaceText(surface).split("\n")[commandLineRow];

  assert.equal(withE.commandLine.dispatchPosture, undefined);
  assert.equal(withEx.commandLine.dispatchPosture.kind, "invalid");
  assert.equal(withEx.commandLine.dispatchPosture.input, "ex");
  assert.equal(withExi.commandLine.dispatchPosture.kind, "invalid");
  assert.equal(withExi.commandLine.dispatchPosture.input, "exi");
  assert.equal(withExAgain.commandLine.dispatchPosture.kind, "invalid");
  assert.equal(backToE.commandLine.dispatchPosture, undefined);
  assert.match(line, /^:exi  Command not recognized; type :help for help/);
  assert.equal(surface.get(1, commandLineRow).bg, "#ff5555");
  assert.equal(surface.get(3, commandLineRow).bg, "#ff5555");
});

test("command-line mode moves the cursor and inserts at the cursor", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const context = mockKeyBindingContext();
  const base = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    commandLine: {
      active: true,
      input: "ed",
      cursorIndex: 2,
      selectedCompletionIndex: 0,
    },
  });

  const [left] = keyBindings.updateFromKey(
    { type: "key", key: "left", ctrl: false, alt: false, shift: false },
    base,
    context,
  );
  const [inserted] = keyBindings.updateFromKey(
    { type: "key", key: "i", ctrl: false, alt: false, shift: false },
    left,
    context,
  );
  const [right] = keyBindings.updateFromKey(
    { type: "key", key: "right", ctrl: false, alt: false, shift: false },
    inserted,
    context,
  );

  assert.equal(left.commandLine.cursorIndex, 1);
  assert.equal(inserted.commandLine.input, "eid");
  assert.equal(inserted.commandLine.cursorIndex, 2);
  assert.equal(right.commandLine.cursorIndex, 3);
});

test("escape cancels command-line mode without dispatching", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    commandLine: {
      active: true,
      input: "edit README.md",
      cursorIndex: 14,
      selectedCompletionIndex: 0,
    },
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "escape", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.commandLine.active, false);
  assert.equal(nextModel.commandLine.input, "");
  assert.equal(nextModel.commandLine.cursorIndex, 0);
  assert.deepEqual(commands, []);
});

test("enter records invalid command posture for unknown commands", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    commandLine: {
      active: true,
      input: "bogus",
      cursorIndex: 5,
      selectedCompletionIndex: 0,
    },
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.commandLine.active, true);
  assert.equal(nextModel.commandLine.dispatchPosture.kind, "invalid");
  assert.equal(nextModel.commandLine.dispatchPosture.input, "bogus");
  assert.deepEqual(commands, []);
});

test("workspace render highlights invalid Vim commands with help text", async () => {
  const [viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 12,
    editor: mockEditor(editorMode),
    focusPane: "editor",
    footerVisible: true,
    i18n: commandLineRenderI18n(),
    jeditTheme: commandLineRenderTheme(),
    commandLine: {
      ...activeCommandLine("foo"),
      dispatchPosture: {
        kind: "invalid",
        input: "foo",
      },
    },
  });
  const surface = viewer.renderWorkspace(model);
  const commandLineRow = model.rows - 2;
  const line = surfaceText(surface).split("\n")[commandLineRow];

  assert.match(line, /^:foo  Command not recognized; type :help for help/);
  assert.equal(surface.get(1, commandLineRow).bg, "#ff5555");
  assert.equal(surface.get(3, commandLineRow).bg, "#ff5555");
  assert.deepEqual(surface.get(6, commandLineRow).modifiers, ["dim"]);
});

test("enter dispatches edit commands through production file open", async () => {
  const [keyBindings, titleScreen, editorMode, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("ports", "file-system.js"),
  ]);
  const loadedFiles = [];
  const openCalls = [];
  const context = mockKeyBindingContext({
    nowMs: () => 77,
    deps: {
      editorFile: {
        loadEditorFile(filePath) {
          loadedFiles.push(filePath);
          return { lines: ["hello world"], readOnly: false };
        },
        saveEditorFile: () => undefined,
      },
      productionTextSession: fakeProductionTextSession({
        openBuffer: async (request) => {
          openCalls.push(request);
          return {
            kind: "opened",
            optic: { buffer: { bufferId: "buffer:readme" } },
          };
        },
        observeWindow: async () => ({
          kind: "observed",
          observed: {
            value: {
              readingId: "reading:readme",
              lines: [{ text: "hello world" }],
              lineCount: 1,
              cursorLine: 0,
              viewportLineCount: 24,
              truncated: false,
            },
          },
        }),
      }),
    },
  });
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    entries: editEntries(fileSystem),
    commandLine: activeCommandLine("edit README.md"),
  });

  const [pendingOpen, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  const message = await commands[0]();

  assert.equal(pendingOpen.commandLine.active, false);
  assert.equal(pendingOpen.textAuthority.kind, "pending-open");
  assert.equal(pendingOpen.textAuthority.filePath, "/repo/README.md");
  assert.equal(pendingOpen.textAuthority.requestId, 1);
  assert.deepEqual(loadedFiles, ["/repo/README.md"]);
  assert.deepEqual(openCalls, [
    {
      bufferKey: "/repo/README.md",
      initialText: "hello world",
      projectionPath: "/repo/README.md",
      atMs: 77,
    },
  ]);
  assert.equal(message.type, "text-open-result");
  assert.equal(message.result.kind, "opened");
});

test("enter dispatches edit commands outside the cwd hierarchy", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const loadedFiles = [];
  const openCalls = [];
  const context = mockKeyBindingContext({
    nowMs: () => 79,
    deps: {
      editorFile: {
        loadEditorFile(filePath) {
          loadedFiles.push(filePath);
          return { lines: ["shared"], readOnly: false };
        },
        saveEditorFile: () => undefined,
      },
      productionTextSession: fakeProductionTextSession({
        openBuffer: async (request) => {
          openCalls.push(request);
          return {
            kind: "opened",
            optic: { buffer: { bufferId: "buffer:shared" } },
          };
        },
        observeWindow: async () => ({
          kind: "observed",
          observed: {
            value: {
              readingId: "reading:shared",
              lines: [{ text: "shared" }],
              lineCount: 1,
              cursorLine: 0,
              viewportLineCount: 24,
              truncated: false,
            },
          },
        }),
      }),
    },
  });
  const model = mockTitleScreenModel(titleScreen, {
    cwd: "/repo/project",
    editor: mockEditor(editorMode),
    focusPane: "editor",
    commandLine: activeCommandLine("edit ../shared.md"),
  });

  const [pendingOpen, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  const message = await commands[0]();

  assert.equal(pendingOpen.commandLine.active, false);
  assert.equal(pendingOpen.textAuthority.kind, "pending-open");
  assert.equal(pendingOpen.textAuthority.filePath, "/repo/shared.md");
  assert.deepEqual(loadedFiles, ["/repo/shared.md"]);
  assert.deepEqual(openCalls, [
    {
      bufferKey: "/repo/shared.md",
      initialText: "shared",
      projectionPath: "/repo/shared.md",
      atMs: 79,
    },
  ]);
  assert.equal(message.type, "text-open-result");
  assert.equal(message.result.kind, "opened");
});

test("enter dispatches edit for missing paths as unmaterialized buffers", async () => {
  const [keyBindings, runtimeModule, viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const loadedFiles = [];
  const savedFiles = [];
  const openCalls = [];
  const productionTextSession = fakeProductionTextSession({
    openBuffer: async (request) => {
      openCalls.push(request);
      return {
        kind: "opened",
        optic: { buffer: { bufferId: "buffer:foo" } },
      };
    },
    observeWindow: async () => ({
      kind: "observed",
      observed: {
        value: {
          readingId: "reading:foo",
          lines: [{ text: "" }],
          lineCount: 1,
          cursorLine: 0,
          viewportLineCount: 24,
          truncated: false,
        },
      },
    }),
  });
  const context = mockKeyBindingContext({
    nowMs: () => 80,
    deps: {
      editorFile: {
        loadEditorFile(filePath) {
          loadedFiles.push(filePath);
          return { kind: "missing", filePath };
        },
        saveEditorFile(filePath, lines) {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession,
    },
  });
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: commandLineRenderTheme(),
    commandLine: activeCommandLine("edit foo.txt"),
  });

  const [pendingOpen, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  const message = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({ productionTextSession }));
  const [opened] = runtime.update(message, pendingOpen);
  const rendered = surfaceText(viewer.renderWorkspace(opened));

  assert.deepEqual(loadedFiles, ["/repo/foo.txt"]);
  assert.deepEqual(openCalls, [
    {
      bufferKey: "/repo/foo.txt",
      initialText: "",
      projectionPath: "/repo/foo.txt",
      atMs: 80,
    },
  ]);
  assert.deepEqual(savedFiles, []);
  assert.equal(opened.textAuthority.kind, "opened");
  assert.equal(opened.textAuthority.materialization, "unmaterialized");
  assert.equal(opened.editor.dirty, false);
  assert.deepEqual(opened.editor.lines, [""]);
  assert.match(rendered, /\/repo\/foo\.txt\s+\[clean \| main \| fs:unmaterialized/);
});

test("enter dispatches write and wq commands through production save", async () => {
  const [keyBindings, runtimeModule, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const savedFiles = [];
  const exportCalls = [];
  const checkpointCalls = [];
  const context = mockKeyBindingContext({
    nowMs: () => 88,
    deps: {
      editorFile: {
        loadEditorFile: () => ({ lines: [], readOnly: false }),
        saveEditorFile(filePath, lines) {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession: fakeProductionTextSession({
        exportSnapshot: async (request) => {
          exportCalls.push(request);
          return {
            kind: "exported",
            text: "alpha\nbeta",
            readingId: "reading:write",
            basisHeadId: "head:write",
          };
        },
        checkpointBuffer: async (request) => {
          checkpointCalls.push(request);
          return {
            kind: "checkpointed",
            result: { checkpointId: "checkpoint:write" },
          };
        },
      }),
    },
  });

  const [written, writeCommands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    commandDispatchModel(titleScreen, editorMode, authority, "w"),
    context,
  );
  const [wqModel, wqCommands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    commandDispatchModel(titleScreen, editorMode, authority, "x"),
    context,
  );
  assert.equal(writeCommands.length, 1);
  assert.equal(wqCommands.length, 1);
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({
      productionTextSession: context.deps.productionTextSession,
    }),
  );
  const writeExportMessage = await writeCommands[0]();
  const [writeExported, writeCheckpointCommands] = runtime.update(
    writeExportMessage,
    written,
  );
  assert.equal(writeCheckpointCommands.length, 1);
  const writeCheckpointMessage = await writeCheckpointCommands[0]();
  runtime.update(writeCheckpointMessage, writeExported);
  const wqExportMessage = await wqCommands[0]();
  const [wqExported, wqCheckpointCommands] = runtime.update(
    wqExportMessage,
    wqModel,
  );
  assert.equal(wqCheckpointCommands.length, 1);
  const wqCheckpointMessage = await wqCheckpointCommands[0]();
  runtime.update(wqCheckpointMessage, wqExported);

  assert.equal(written.commandLine.active, false);
  assert.equal(written.quitConfirmOpen, false);
  assert.equal(written.textRequestId, 1);
  assert.equal(wqModel.commandLine.active, false);
  assert.equal(wqModel.quitConfirmOpen, false);
  assert.equal(wqModel.quitAfterSaveRequestId, 1);
  assert.equal(wqModel.textRequestId, 1);
  assert.equal(wqExported.quitConfirmOpen, true);
  assert.equal(wqExported.quitAfterSaveRequestId, undefined);
  assert.deepEqual(savedFiles, [
    { filePath: "/repo/notes.md", lines: ["alpha", "beta"] },
    { filePath: "/repo/notes.md", lines: ["alpha", "beta"] },
  ]);
  assert.equal(exportCalls.length, 2);
  assert.equal(checkpointCalls.length, 2);
});

test("blocked production wq remains open with honest materialization status", async () => {
  const [keyBindings, runtimeModule, titleScreen, editorMode, authority, footerPosture] =
    await Promise.all([
      importDist("app", "workspace", "key-bindings.js"),
      importDist("app", "workspace", "runtime.js"),
      importDist("ui", "title-screen.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "workspace", "workspace-footer-posture.js"),
    ]);
  const savedFiles = [];
  const exportCalls = [];
  const checkpointCalls = [];
  const productionTextSession = fakeProductionTextSession({
    exportSnapshot: async (request) => {
      exportCalls.push(request);
      return {
        kind: "exported",
        text: "alpha\nbeta",
        readingId: "reading:wq",
        basisHeadId: "head:wq",
      };
    },
    checkpointBuffer: async (request) => {
      checkpointCalls.push(request);
      return {
        kind: "checkpointed",
        result: { checkpointId: "checkpoint:wq" },
      };
    },
  });
  const context = mockKeyBindingContext({
    nowMs: () => 89,
    deps: {
      editorFile: {
        loadEditorFile: () => ({
          lines: ["external"],
          readOnly: false,
          fingerprint: HOST_FINGERPRINT_B,
        }),
        saveEditorFile(filePath, lines) {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession,
    },
  });
  const baseModel = commandDispatchModel(titleScreen, editorMode, authority, "x");
  const model = {
    ...baseModel,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
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

  const [pendingWq, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  assert.equal(commands.length, 1);
  assert.equal(pendingWq.quitConfirmOpen, false);
  assert.equal(pendingWq.quitAfterSaveRequestId, 1);
  const exportMessage = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(
    mockRuntime({ productionTextSession }),
  );
  const [blockedModel] = runtime.update(exportMessage, pendingWq);
  const footer = footerPosture.workspaceFooterTextPosture(blockedModel);

  assert.equal(exportMessage.result.kind, "obstructed");
  assert.match(exportMessage.result.issue.message, /changed on disk after open/);
  assert.deepEqual(exportCalls, [{ bufferId: "buffer:notes", atMs: 89 }]);
  assert.deepEqual(checkpointCalls, []);
  assert.deepEqual(savedFiles, []);
  assert.equal(blockedModel.quitConfirmOpen, false);
  assert.equal(blockedModel.quitAfterSaveRequestId, undefined);
  assert.equal(blockedModel.textAuthority.dirty, true);
  assert.equal(blockedModel.textAuthority.materialization, "unmaterialized");
  assert.equal(blockedModel.editor.dirty, true);
  assert.match(footer, /dirty \| main \| fs:unmaterialized/);
});

test("pending production intent queues wq save without arming quit confirmation", async () => {
  const [keyBindings, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const exportCalls = [];
  const context = mockKeyBindingContext({
    nowMs: () => 90,
    deps: {
      productionTextSession: fakeProductionTextSession({
        exportSnapshot: async (request) => {
          exportCalls.push(request);
          return {
            kind: "exported",
            text: "stale",
            readingId: "reading:stale",
            basisHeadId: "head:stale",
          };
        },
      }),
    },
  });
  const baseModel = commandDispatchModel(titleScreen, editorMode, authority, "x");
  const model = {
    ...baseModel,
    textRequestId: 4,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      pendingClientSeq: 4,
      pendingIntentStatus: authority.WorkspaceTextIntentStatuses.Predicted,
    }),
  };

  const [pendingSaveModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );

  assert.equal(pendingSaveModel.textRequestId, 5);
  assert.equal(pendingSaveModel.quitConfirmOpen, false);
  assert.equal(pendingSaveModel.quitAfterSaveRequestId, undefined);
  assert.equal(commands.length, 1);
  assert.equal(exportCalls.length, 0);
  await commands[0]();
  assert.deepEqual(exportCalls, [{ bufferId: "buffer:notes", atMs: 90 }]);
});

test("enter dispatches quit commands through the quit confirmation posture", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const inputs = ["quit", "q"];

  for (const input of inputs) {
    const [nextModel, commands] = keyBindings.updateFromKey(
      { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
      mockTitleScreenModel(titleScreen, {
        editor: mockEditor(editorMode),
        focusPane: "editor",
        commandLine: activeCommandLine(input),
      }),
      mockKeyBindingContext(),
    );

    assert.equal(nextModel.commandLine.active, false);
    assert.equal(nextModel.quitConfirmOpen, true);
    assert.deepEqual(commands, []);
  }
});

test("enter dispatches forced quit commands without confirmation", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const inputs = ["q!", "quit!"];

  for (const input of inputs) {
    const [nextModel, commands] = keyBindings.updateFromKey(
      { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
      mockTitleScreenModel(titleScreen, {
        editor: mockEditor(editorMode, { dirty: true }),
        focusPane: "editor",
        commandLine: activeCommandLine(input),
      }),
      mockKeyBindingContext(),
    );

    assert.equal(nextModel.commandLine.active, false);
    assert.equal(nextModel.quitConfirmOpen, false);
    assert.equal(commands.length, 1);
  }
});

test("enter dispatches why with a calm no-event obstruction", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      editor: mockEditor(editorMode),
      focusPane: "editor",
      commandLine: activeCommandLine("why"),
    }),
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.commandLine.active, false);
  assert.equal(nextModel.inlinePanel.title, "Why");
  assert.match(
    nextModel.inlinePanel.message,
    /No meaningful command recorded yet.*jedit_why_no_meaningful_event/,
  );
  assert.equal(nextModel.inlinePanel.anchorRow, 0);
  assert.equal(nextModel.inlinePanel.anchorColumn, 0);
  assert.equal(commands.length, 0);
});

test("enter dispatches help into an anchored inline panel", async () => {
  const [keyBindings, viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 96,
    rows: 20,
    editor: mockEditor(editorMode, {
      lines: ["alpha beta"],
      cursorRow: 0,
      cursorCol: 6,
    }),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: commandLineRenderTheme(),
    commandLine: activeCommandLine("help braid"),
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const rendered = surfaceText(viewer.renderWorkspace(nextModel));

  assert.equal(nextModel.commandLine.active, false);
  assert.equal(nextModel.inlinePanel.title, ":braid");
  assert.match(nextModel.inlinePanel.message, /Usage: :braid/);
  assert.match(rendered, /i :braid/);
  assert.match(rendered, /Usage: :braid/);
  assert.deepEqual(commands, []);

  const [cleared] = keyBindings.updateFromKey(
    { type: "key", key: "escape", ctrl: false, alt: false, shift: false },
    nextModel,
    mockKeyBindingContext(),
  );
  assert.equal(cleared.inlinePanel, undefined);
});

test("help inline panels render at the cursor column when horizontally visible", async () => {
  const [keyBindings, viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 96,
    rows: 20,
    editor: mockEditor(editorMode, {
      lines: ["alpha beta gamma"],
      cursorRow: 0,
      cursorCol: 11,
      scrollCol: 0,
    }),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: commandLineRenderTheme(),
    commandLine: activeCommandLine("help braid"),
  });

  const [nextModel] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const rows = surfaceText(viewer.renderWorkspace(nextModel)).split("\n");
  const panelRow = rows.find((row) => row.includes("│ i :braid"));
  const sourceRow = rows.find((row) => row.includes("alpha beta gamma"));

  assert.ok(panelRow != null, "expected rendered inline help panel");
  assert.ok(sourceRow != null, "expected rendered source row");
  assert.equal(
    panelRow.indexOf("│ i :braid"),
    sourceRow.indexOf("alpha beta gamma") + nextModel.inlinePanel.anchorColumn,
  );
});

test("help inline panels account for horizontal editor scroll", async () => {
  const [keyBindings, viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 96,
    rows: 20,
    editor: mockEditor(editorMode, {
      lines: ["0123456789abcDEF uvw"],
      cursorRow: 0,
      cursorCol: 13,
      scrollCol: 10,
    }),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: commandLineRenderTheme(),
    commandLine: activeCommandLine("help braid"),
  });

  const [nextModel] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const rows = surfaceText(viewer.renderWorkspace(nextModel)).split("\n");
  const panelRow = rows.find((row) => row.includes("│ i :braid"));
  const sourceRow = rows.find((row) => row.includes("abcDEF uvw"));

  assert.ok(panelRow != null, "expected rendered inline help panel");
  assert.ok(sourceRow != null, "expected rendered scrolled source row");
  assert.equal(
    panelRow.indexOf("│ i :braid"),
    sourceRow.indexOf("abcDEF uvw") +
      nextModel.inlinePanel.anchorColumn -
      nextModel.editor.scrollCol,
  );
});

test("inline panels do not render when the anchor column is horizontally off-screen", async () => {
  const [viewer, titleScreen, editorMode, inlinePanel] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-inline-panel.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 96,
    rows: 20,
    editor: mockEditor(editorMode, {
      lines: ["0123456789abcDEF uvw"],
      cursorRow: 0,
      cursorCol: 12,
      scrollCol: 10,
    }),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: commandLineRenderTheme(),
    inlinePanel: {
      title: ":braid",
      message: "Usage: :braid",
      tone: inlinePanel.WORKSPACE_INLINE_PANEL_TONE.Info,
      anchorRow: 0,
      anchorColumn: 4,
    },
  });

  const rendered = surfaceText(viewer.renderWorkspace(model));

  assert.doesNotMatch(rendered, /i :braid/);
  assert.doesNotMatch(rendered, /Usage: :braid/);
});

test("inline panels clear when the active buffer changes at the same cursor position", async () => {
  const [inlinePanel, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "workspace-inline-panel.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha beta"],
      cursorRow: 0,
      cursorCol: 0,
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/a.md",
      bufferId: "buffer:a",
      readOnly: false,
      dirty: false,
    }),
    inlinePanel: {
      title: "Why",
      message: "buffer-a explanation",
      tone: inlinePanel.WORKSPACE_INLINE_PANEL_TONE.Info,
      anchorRow: 0,
      anchorColumn: 0,
      bufferId: "buffer:a",
    },
  });
  const nextModel = {
    ...model,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/b.md",
      bufferId: "buffer:b",
      readOnly: false,
      dirty: false,
    }),
  };

  const cleared = inlinePanel.clearWorkspaceInlinePanelAfterKey(
    { type: "key", key: "a", ctrl: false, alt: false, shift: false },
    nextModel,
  );

  assert.equal(cleared.inlinePanel, undefined);
});

test("inline panels clear when opening and dismissing quit confirmation", async () => {
  const [keyBindings, titleScreen, editorMode, inlinePanel] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-inline-panel.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha beta"],
      cursorRow: 0,
      cursorCol: 0,
    }),
    focusPane: "editor",
    settingsOpen: false,
    viewMode: "source",
    inlinePanel: {
      title: "Why",
      message: "same-cursor explanation",
      tone: inlinePanel.WORKSPACE_INLINE_PANEL_TONE.Info,
      anchorRow: 0,
      anchorColumn: 0,
    },
  });

  const [opened] = keyBindings.updateFromKey(
    { type: "key", key: "q", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const [dismissed] = keyBindings.updateFromKey(
    { type: "key", key: "q", ctrl: false, alt: false, shift: false },
    opened,
    mockKeyBindingContext(),
  );

  assert.equal(opened.quitConfirmOpen, true);
  assert.equal(opened.inlinePanel, undefined);
  assert.equal(dismissed.quitConfirmOpen, false);
  assert.equal(dismissed.inlinePanel, undefined);
});

test("inline panels clear when source editor no longer owns focus", async () => {
  const [inlinePanel, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "workspace-inline-panel.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha beta"],
      cursorRow: 0,
      cursorCol: 0,
    }),
    focusPane: "editor",
    settingsOpen: false,
    viewMode: "source",
    commandLine: {
      active: false,
      input: "",
      cursorIndex: 0,
      anchorCursorIndex: 0,
      selectedCompletionIndex: 0,
    },
    inlinePanel: {
      title: "Why",
      message: "same-cursor explanation",
      tone: inlinePanel.WORKSPACE_INLINE_PANEL_TONE.Info,
      anchorRow: 0,
      anchorColumn: 0,
    },
  });
  const cases = [
    { settingsOpen: true },
    { viewMode: "preview" },
    { focusPane: "files" },
    {
      commandLine: {
        active: true,
        input: "",
        cursorIndex: 0,
        anchorCursorIndex: 0,
        selectedCompletionIndex: 0,
      },
    },
  ];

  for (const overrides of cases) {
    const cleared = inlinePanel.clearWorkspaceInlinePanelAfterKey(
      { type: "key", key: "f2", ctrl: false, alt: false, shift: false },
      { ...model, ...overrides },
    );
    assert.equal(cleared.inlinePanel, undefined);
  }
});

test("enter keeps non-no-event command why obstructions on the command path", async () => {
  const [keyBindings, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const explainRangeCalls = [];
  const productionTextSession = fakeProductionTextSession({
    explainRange: async (request) => {
      explainRangeCalls.push(request);
      return {
        kind: "range-explained",
        report: fakeProducedRangeWhyReport(request.range),
      };
    },
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      editor: mockEditor(editorMode, {
        lines: ["alpha Jim"],
        cursorRow: 0,
        cursorCol: 7,
        lastVimEdit: {
          keys: ["d"],
          description: "operator:delete:",
          replayPolicy: "resolve-current-basis",
        },
      }),
      focusPane: "editor",
      textAuthority: authority.openedWorkspaceTextAuthority({
        profile: "echoHosted",
        filePath: "/repo/notes.md",
        bufferId: "text-buffer:0",
        readOnly: false,
        dirty: true,
      }),
      commandLine: activeCommandLine("why"),
    }),
    mockKeyBindingContext({ deps: { productionTextSession } }),
  );

  assert.equal(nextModel.commandLine.active, false);
  assert.equal(nextModel.inlinePanel.title, "Why");
  assert.match(nextModel.inlinePanel.message, /jedit_command_event_invalid_syntax/);
  assert.doesNotMatch(nextModel.inlinePanel.message, /ropeDiff/);
  assert.deepEqual(explainRangeCalls, []);
  assert.equal(commands.length, 0);
});

test("enter dispatches why for the last meaningful Vim command", async () => {
  const [keyBindings, titleScreen, editorMode, editing, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "editor-editing.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const editor = mockEditor(editorMode, {
    lines: ["alpha beta"],
    cursorRow: 0,
    cursorCol: 0,
  });
  const pending = editing.updateNormalMode(editor, { key: "d" }, 80, 24);
  const deleted = editing.updateNormalMode(pending, { key: "w" }, 80, 24);

  const [nextModel] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      editor: deleted,
      focusPane: "editor",
      textAuthority: authority.openedWorkspaceTextAuthority({
        profile: "echoHosted",
        filePath: "/repo/notes.md",
        bufferId: "buffer:notes",
        readOnly: false,
        dirty: true,
        lastReceiptId: "receipt:dw",
      }),
      commandLine: activeCommandLine("Why"),
    }),
    mockKeyBindingContext(),
  );
  const message = nextModel.inlinePanel.message;

  assert.equal(nextModel.commandLine.active, false);
  assert.match(message, /command: dw/);
  assert.match(message, /family: operatorMotion/);
  assert.match(message, /operator: delete/);
  assert.match(message, /motion: wordForward/);
  assert.match(message, /target: motion charwise 0\.\.6/);
  assert.match(message, /register: char delete 0\.\.6/);
  assert.match(message, /receipt: receipt:dw/);
  assert.match(message, /summary: dw delete motion 0\.\.6 receipt receipt:dw/);
});

test("enter dispatches why through retained range history when a cursor range is provable", async () => {
  const [keyBindings, runtimeModule, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const explainCalls = [];
  const productionTextSession = fakeProductionTextSession({
    explainRange: async (request) => {
      explainCalls.push(request);
      return {
        kind: "range-explained",
        report: fakeProducedRangeWhyReport(request.range),
      };
    },
  });
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha Jim"],
      cursorRow: 0,
      cursorCol: 7,
      lastVimEdit: undefined,
    }),
    focusPane: "editor",
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "text-buffer:0",
      readOnly: false,
      dirty: true,
    }),
    commandLine: activeCommandLine("why"),
  });

  const [pendingWhy, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ nowMs: () => 90, deps: { productionTextSession } }),
  );
  const message = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({ productionTextSession }));
  const [notified] = runtime.update(message, pendingWhy);
  const [stale] = runtime.update(message, {
    ...pendingWhy,
    editor: {
      ...pendingWhy.editor,
      cursorCol: 8,
    },
  });
  const [staleBuffer] = runtime.update(message, {
    ...pendingWhy,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/other.md",
      bufferId: "text-buffer:1",
      readOnly: false,
      dirty: true,
    }),
  });

  assert.equal(pendingWhy.commandLine.active, false);
  assert.equal(commands.length, 1);
  assert.deepEqual(explainCalls, [{
    bufferId: "text-buffer:0",
    range: { startByte: byteOffset(6), endByte: byteOffset(9) },
    atMs: 90,
  }]);
  assert.equal(message.type, "why-range-result");
  assert.deepEqual(message.anchor, { row: 0, column: 7 });
  assert.equal(message.outcome.kind, "range");
  assert.equal(Object.hasOwn(message, "report"), false);
  assert.equal(Object.hasOwn(message, "obstruction"), false);
  assert.match(notified.inlinePanel.message, /ropeDiff receipt:range/);
  assert.doesNotMatch(notified.inlinePanel.message, /No meaningful command/);
  assert.equal(stale.inlinePanel, undefined);
  assert.equal(staleBuffer.inlinePanel, undefined);
});

test("enter dispatches why with typed unavailable range evidence", async () => {
  const [keyBindings, runtimeModule, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const productionTextSession = fakeProductionTextSession({
    explainRange: async (request) => ({
      kind: "range-explained",
      report: fakeUnavailableRangeWhyReport(request.range),
    }),
  });
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha Jim"],
      cursorRow: 0,
      cursorCol: 7,
      lastVimEdit: undefined,
    }),
    focusPane: "editor",
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "text-buffer:0",
      readOnly: false,
      dirty: true,
    }),
    commandLine: activeCommandLine("why"),
  });

  const [pendingWhy, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ nowMs: () => 90, deps: { productionTextSession } }),
  );
  const message = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({ productionTextSession }));
  const [notified] = runtime.update(message, pendingWhy);

  assert.equal(pendingWhy.commandLine.active, false);
  assert.equal(message.type, "why-range-result");
  assert.equal(notified.inlinePanel.title, "Why range");
  assert.match(notified.inlinePanel.message, /jedit_why_range_retained_history_horizon/);
  assert.doesNotMatch(notified.inlinePanel.message, /No meaningful command/);
});

test("enter dispatches why with typed range obstruction evidence", async () => {
  const [keyBindings, runtimeModule, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const productionTextSession = fakeProductionTextSession({
    explainRange: async () => ({
      kind: "obstructed",
      obstruction: {
        code: "text-buffer-why-range-obstructed",
        issue: {
          source: "production-text",
          level: "error",
          code: "text-buffer-why-range-obstructed",
          message: "range explanation failed",
        },
      },
    }),
  });
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha Jim"],
      cursorRow: 0,
      cursorCol: 7,
      lastVimEdit: undefined,
    }),
    focusPane: "editor",
    i18n: mockI18n({
      translations: {
        "why.range_obstructed_title": "Range why blocked",
      },
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "text-buffer:0",
      readOnly: false,
      dirty: true,
    }),
    commandLine: activeCommandLine("why"),
  });

  const [pendingWhy, commands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ nowMs: () => 90, deps: { productionTextSession } }),
  );
  const message = await commands[0]();
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({ productionTextSession }));
  const [notified] = runtime.update(message, pendingWhy);

  assert.equal(pendingWhy.commandLine.active, false);
  assert.equal(message.type, "why-range-result");
  assert.equal(notified.inlinePanel.title, "Range why blocked");
  assert.match(notified.inlinePanel.message, /text-buffer-why-range-obstructed/);
  assert.match(notified.inlinePanel.message, /range explanation failed/);
  assert.doesNotMatch(notified.inlinePanel.message, /No meaningful command/);
});

test("command provenance validates slice 1 Vim edit targets", async () => {
  const [mode, syntax, executor, authority, provenance] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "workspace", "command-provenance.js"),
  ]);
  const cases = [
    {
      command: "dw",
      keys: ["d", "w"],
      lines: ["alpha beta"],
      targetKind: "motion",
      shape: "charwise",
    },
    {
      command: "ciw",
      keys: ["c", "i", "w"],
      lines: ["alpha beta"],
      targetKind: "textObject",
      shape: "charwise",
    },
    {
      command: "dd",
      keys: ["d", "d"],
      lines: ["alpha", "beta"],
      targetKind: "motion",
      shape: "linewise",
    },
    {
      command: "gUap",
      keys: ["g", "U", "a", "p"],
      lines: ["alpha", "beta", "", "gamma"],
      targetKind: "textObject",
      shape: "linewise",
    },
  ];

  for (const item of cases) {
    const editor = mockEditor(mode, { lines: item.lines, cursorRow: 0, cursorCol: 0 });
    const edited = executor.applyVimChordSyntaxToEditor(editor, syntax.parseVimChordSyntax(item.keys));
    assert.ok(edited.lastVimEdit, `${item.command} should record repeat/provenance state`);
    const event = provenance.createJeditCommandEvent({
      editor: edited,
      repeat: edited.lastVimEdit,
      textAuthority: authority.openedWorkspaceTextAuthority({
        profile: "echoHosted",
        filePath: "/repo/notes.md",
        bufferId: "buffer:notes",
        readOnly: false,
        dirty: true,
        lastReceiptId: `receipt:${item.command}`,
      }),
    });

    assert.equal(event.kind, "vim");
    assert.equal(event.command, item.command);
    assert.equal(event.target.kind, item.targetKind);
    assert.equal(event.target.shape, item.shape);
    assert.equal(event.receipt.posture, "received");
    assert.equal(event.receiptId, `receipt:${item.command}`);
    assert.equal(event.target.rangeEnd > event.target.rangeStart, true);
    assert.match(event.summary, new RegExp(`^${item.command} `));
  }
});

function fakeProducedRangeWhyReport(range) {
  return {
    kind: "range",
    title: "Why range",
    message: `range: ${range.startByte}..${range.endByte} | ropeDiff receipt:range`,
    witness: {
      worldlineId: "wl:/repo/notes.md",
      currentHeadId: "head:2",
      queriedRange: range,
      reverseWalk: { coordinateKind: "range-at-head", inspectedDiffIds: ["receipt:range"] },
      result: {
        kind: "produced",
        ropeRewriteId: "tick:range",
        ropeDiffId: "receipt:range",
        tickId: "tick:range",
        receiptId: "receipt:range",
        baseHeadId: "head:1",
        nextHeadId: "head:2",
        startByte: range.startByte,
        endByte: range.endByte,
        insertedByteLength: range.endByte - range.startByte,
        deletedByteLength: 0,
      },
      evidencePosture: { causalHistory: "available", btr: "missing" },
    },
  };
}

function fakeUnavailableRangeWhyReport(range) {
  return {
    kind: "range",
    title: "Why range",
    message: `No retained rope diff proves range ${range.startByte}..${range.endByte}: jedit_why_range_retained_history_horizon`,
    witness: {
      worldlineId: "wl:/repo/notes.md",
      currentHeadId: "head:2",
      queriedRange: range,
      reverseWalk: { coordinateKind: "range-at-head", inspectedDiffIds: [] },
      result: {
        kind: "unavailable",
        code: "jedit_why_range_retained_history_horizon",
        reason: "Retained rope history does not identify a producing diff for this range.",
      },
      evidencePosture: { causalHistory: "unavailable", btr: "missing" },
    },
  };
}

test("command provenance reports pending posture while a new edit is in flight", async () => {
  const [editorMode, authority, provenance] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "workspace", "command-provenance.js"),
  ]);
  const editor = mockEditor(editorMode, {
    lastVimEdit: {
      keys: ["c", "i", "w"],
      description: "operatorTextObject:change:",
      replayPolicy: "resolve-current-basis",
      sourceBasisDigest: "basis:pending",
      target: {
        basisDigest: "basis:pending",
        rangeStart: 0,
        rangeEnd: 5,
        shape: "charwise",
      },
    },
  });
  const opened = authority.openedWorkspaceTextAuthority({
    profile: "echoHosted",
    filePath: "/repo/notes.md",
    bufferId: "buffer:notes",
    readOnly: false,
    dirty: true,
    lastReceiptId: "receipt:old",
  });

  const event = provenance.createJeditCommandEvent({
    editor,
    repeat: editor.lastVimEdit,
    textAuthority: authority.workspaceTextAuthorityWithPendingEdit(opened, 7, authority.WorkspaceTextPendingCommandKinds.Vim),
  });

  assert.equal(event.kind, "vim");
  assert.equal(event.receipt.posture, "pending");
  assert.equal(event.receiptId, undefined);
  assert.match(event.summary, /receipt pending/);
});

test("command provenance prefers stored command events over mutable editor repeat state", async () => {
  const [editorMode, syntax, executor, authority, provenance] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "workspace", "command-provenance.js"),
  ]);
  const opened = authority.openedWorkspaceTextAuthority({
    profile: "echoHosted",
    filePath: "/repo/notes.md",
    bufferId: "buffer:notes",
    readOnly: false,
    dirty: true,
    lastReceiptId: "receipt:dw",
  });
  const deleted = executor.applyVimChordSyntaxToEditor(
    mockEditor(editorMode, { lines: ["alpha beta"], cursorRow: 0, cursorCol: 0 }),
    syntax.parseVimChordSyntax(["d", "w"]),
  );
  assert.ok(deleted.lastVimEdit);
  const event = provenance.createJeditCommandEvent({
    editor: deleted,
    requestId: 12,
    repeat: deleted.lastVimEdit,
    textAuthority: opened,
  });
  assert.equal(event.kind, "vim");

  const report = provenance.explainLastJeditCommand(
    mockEditor(editorMode, {
      lastVimEdit: {
        keys: ["c", "i", "w"],
        description: "operatorTextObject:change:",
        replayPolicy: "resolve-current-basis",
        sourceBasisDigest: "basis:stale",
        target: {
          basisDigest: "basis:stale",
          rangeStart: 0,
          rangeEnd: 5,
          shape: "charwise",
        },
      },
    }),
    authority.openedWorkspaceTextAuthority({
      ...opened,
      lastCommandEvent: event,
    }),
  );

  assert.equal(report.kind, "event");
  assert.match(report.message, /command: dw/);
  assert.match(report.message, /receipt: receipt:dw/);
  assert.doesNotMatch(report.message, /command: ciw/);
});

test("pending non-Vim edits do not rewrite stored command receipt posture", async () => {
  const [editorMode, syntax, executor, authority, provenance] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "workspace", "command-provenance.js"),
  ]);
  const opened = authority.openedWorkspaceTextAuthority({
    profile: "echoHosted",
    filePath: "/repo/notes.md",
    bufferId: "buffer:notes",
    readOnly: false,
    dirty: true,
    lastReceiptId: "receipt:dw",
  });
  const deleted = executor.applyVimChordSyntaxToEditor(
    mockEditor(editorMode, { lines: ["alpha beta"], cursorRow: 0, cursorCol: 0 }),
    syntax.parseVimChordSyntax(["d", "w"]),
  );
  assert.ok(deleted.lastVimEdit);
  const event = provenance.createJeditCommandEvent({
    editor: deleted,
    requestId: 12,
    repeat: deleted.lastVimEdit,
    textAuthority: opened,
  });
  assert.equal(event.kind, "vim");
  const pendingInsert = authority.workspaceTextAuthorityWithPendingEdit(
    authority.openedWorkspaceTextAuthority({
      ...opened,
      lastCommandEvent: event,
    }),
    13,
  );

  const report = provenance.explainLastJeditCommand(undefined, pendingInsert);

  assert.equal(report.kind, "event");
  assert.match(report.message, /command: dw/);
  assert.match(report.message, /receipt: receipt:dw/);
  assert.doesNotMatch(report.message, /receipt: pending/);
});

test("command provenance does not synthesize targets from stale registers", async () => {
  const [editorMode, authority, provenance] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "workspace", "command-provenance.js"),
  ]);
  const editor = mockEditor(editorMode, {
    register: {
      kind: "char",
      text: "alpha",
      source: {
        basisDigest: "basis:yank",
        operation: "yank",
        rangeStart: 0,
        rangeEnd: 5,
      },
    },
    lastVimEdit: {
      keys: ["p"],
      description: "put:putAfter:",
      replayPolicy: "resolve-current-basis",
      sourceBasisDigest: "basis:put",
    },
  });

  const event = provenance.createJeditCommandEvent({
    editor,
    repeat: editor.lastVimEdit,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      lastReceiptId: "receipt:put",
    }),
  });

  assert.equal(event.kind, "vim");
  assert.equal(event.target, undefined);
  assert.match(event.summary, /target unavailable/);
});

test("production normal edits keep Vim command provenance while queued", async () => {
  const [keyBindings, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["alpha beta"],
      cursorRow: 0,
      cursorCol: 0,
    }),
    focusPane: "editor",
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: false,
    }),
  });
  const context = mockKeyBindingContext();
  const [pending] = keyBindings.updateFromKey(
    { type: "key", key: "d", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  const [queued, commands] = keyBindings.updateFromKey(
    { type: "key", key: "w", ctrl: false, alt: false, shift: false },
    pending,
    context,
  );

  assert.deepEqual(queued.editor.lastVimEdit.keys, ["d", "w"]);
  assert.equal(queued.textAuthority.pendingCommandEvent.requestId, queued.textRequestId);
  assert.equal(queued.textAuthority.pendingCommandEvent.event.command, "dw");
  assert.equal(queued.textAuthority.lastCommandEvent.requestId, queued.textRequestId);
  assert.match(queued.textAuthority.lastCommandEvent.summary, /dw delete motion 0\.\.6 receipt pending/);
  assert.equal(queued.editor.register.source.operation, "delete");
  assert.equal(queued.editor.register.source.rangeStart, 0);
  assert.equal(queued.editor.register.source.rangeEnd, 6);
  assert.equal(commands.length, 1);
});

test("forced quit commands are valid command-line input without visible completions", async () => {
  const [completion, validation] = await Promise.all([
    importDist("app", "workspace", "command-completion.js"),
    importDist("app", "workspace", "command-line-validation.js"),
  ]);

  assert.equal(
    validation.commandLineInputInvalid(activeCommandLine("q!")),
    false,
  );
  assert.equal(
    validation.commandLineInputInvalid(activeCommandLine("quit!")),
    false,
  );
  assert.deepEqual(
    completion.workspaceCommandCompletionItems({
      input: "q!",
      cursorIndex: 2,
    }),
    [],
  );
});

test("colon does not enter command mode while higher-priority overlays own focus", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const overlays = [
    mockTitleScreenModel(titleScreen, {
      editor: mockEditor(editorMode),
      focusPane: "editor",
      quitConfirmOpen: true,
    }),
    mockTitleScreenModel(titleScreen, {
      editor: mockEditor(editorMode),
      focusPane: "editor",
      settingsOpen: true,
    }),
    mockTitleScreenModel(titleScreen, {
      editor: mockEditor(editorMode),
      focusPane: "editor",
      scenePickerOpen: true,
    }),
    mockTitleScreenModel(titleScreen, {
      editor: undefined,
      focusPane: "editor",
      startupIntroComplete: true,
      startupFileModalOpen: true,
    }),
  ];

  for (const model of overlays) {
    const [nextModel] = keyBindings.updateFromKey(
      { type: "key", key: ":", ctrl: false, alt: false, shift: false },
      model,
      mockKeyBindingContext(),
    );

    assert.equal(nextModel.commandLine.active, false);
  }
});

function activeCommandLine(input) {
  return {
    active: true,
    input,
    cursorIndex: input.length,
    anchorCursorIndex: 0,
    selectedCompletionIndex: 0,
  };
}

function commandDispatchModel(titleScreen, editorMode, authority, input) {
  return mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      path: "/repo/notes.md",
      dirty: true,
    }),
    focusPane: "editor",
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
    }),
    commandLine: activeCommandLine(input),
  });
}

function editEntries(fileSystem) {
  return [
    {
      kind: fileSystem.FileEntryKinds.File,
      name: "README.md",
      path: "/repo/README.md",
    },
  ];
}

function commandLineRenderI18n() {
  return {
    locale: "en",
    localeLabel: "English",
    direction: "ltr",
    locales: [],
    t: (path) =>
      path === "footer.command.invalid"
        ? "Command not recognized; type :help for help"
        : path,
    setLocale: () => undefined,
    withLocale: () => commandLineRenderI18n(),
  };
}

function commandLineRenderTheme() {
  const workspace = token("#f0f6fc", "#0d1117");
  const footer = token("#c9d1d9", "#0b1016");
  const edge = { ...token("#58a6ff", "#0d1117"), char: "│" };
  return {
    name: "test",
    mode: "dark",
    familyName: "test",
    variantSource: "authored",
    variables: new Map([
      ["warning", { hex: "#ff5555", rgb: [255, 85, 85] }],
    ]),
    source: new Map(),
    sourceRoleMap: new Map(),
    markdown: new Map(),
    surface: { workspace, drawer: footer, footer },
    cursor: { normal: workspace, insert: workspace },
    chrome: {
      activeEdge: edge,
      titleLogo: workspace,
      titleLogoShadow: workspace,
      titleSceneNear: workspace,
      titleSceneFar: workspace,
    },
  };
}

function token(fg, bg) {
  return {
    fg,
    bg,
    foregroundVariables: [],
    backgroundVariables: [],
  };
}
