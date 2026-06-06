import assert from "node:assert/strict";
import test from "node:test";
import {
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
  assert.equal(nextModel.commandLine.selectedCompletionIndex, 0);
  assert.equal(nextModel.editor.mode, editorMode.EditorModes.Normal);
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
  const [backspaced, commands] = keyBindings.updateFromKey(
    { type: "key", key: "backspace", ctrl: false, alt: false, shift: false },
    withEd,
    context,
  );

  assert.equal(withE.commandLine.input, "e");
  assert.equal(withE.commandLine.cursorIndex, 1);
  assert.equal(withEd.commandLine.input, "ed");
  assert.equal(withEd.commandLine.cursorIndex, 2);
  assert.equal(backspaced.commandLine.input, "e");
  assert.equal(backspaced.commandLine.cursorIndex, 1);
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

test("enter records invalid command posture before dispatch exists", async () => {
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
