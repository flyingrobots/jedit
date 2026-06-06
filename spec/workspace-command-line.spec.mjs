import assert from "node:assert/strict";
import test from "node:test";
import {
  fakeProductionTextSession,
  importDist,
  mockEditor,
  mockKeyBindingContext,
  mockTitleScreenModel,
} from "./workspace-helpers.mjs";

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

test("enter dispatches write and wq commands through production save", async () => {
  const [keyBindings, titleScreen, editorMode, authority] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
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
        exportWindow: async (request) => {
          exportCalls.push(request);
          return {
            kind: "exported",
            text: "alpha\nbeta",
            readingId: "reading:write",
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
  await writeCommands[0]();
  await writeCommands[1]();
  await wqCommands[0]();
  await wqCommands[1]();

  assert.equal(written.commandLine.active, false);
  assert.equal(written.quitConfirmOpen, false);
  assert.equal(written.textRequestId, 1);
  assert.equal(wqModel.commandLine.active, false);
  assert.equal(wqModel.quitConfirmOpen, true);
  assert.equal(wqModel.textRequestId, 1);
  assert.deepEqual(savedFiles, [
    { filePath: "/repo/notes.md", lines: ["alpha", "beta"] },
    { filePath: "/repo/notes.md", lines: ["alpha", "beta"] },
  ]);
  assert.equal(exportCalls.length, 2);
  assert.equal(checkpointCalls.length, 2);
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
