import assert from "node:assert/strict";
import test from "node:test";
import { QUIT } from "@flyingrobots/bijou-tui";
import {
  importDist,
  mockDeps,
  mockEditor,
  mockI18n,
  mockKeyBindingContext,
  mockTitleScreenModel,
} from "./workspace-helpers.mjs";

test("backtick key dispatches a toggle-perf workspace message", async () => {
  const keyBindings = await importDist("app", "workspace", "key-bindings.js");
  const [nextModel, commands] = keyBindings.updateFromKey(
    { key: "`" },
    { perfVisible: false },
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.perfVisible, false);
  assert.equal(commands.length, 1);

  const message = await commands[0]();
  assert.deepEqual(message, { type: "toggle-perf" });
});

test("backtick key remains a perf toggle while workspace overlays are open", async () => {
  const [keyBindings, titleScreen, themes] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
  ]);
  const jeditTheme = themes.availableJeditThemes()[0];
  const overlays = [
    mockTitleScreenModel(titleScreen, {
      settingsOpen: true,
      i18n: mockI18n(),
      jeditTheme,
      markdownPreviewActive: false,
      viewMode: "source",
    }),
    mockTitleScreenModel(titleScreen, {
      startupIntroComplete: true,
      startupFileModalOpen: true,
      startupFileModalInput: "",
    }),
  ];

  for (const model of overlays) {
    const [nextModel, commands] = keyBindings.updateFromKey(
      { key: "`" },
      model,
      mockKeyBindingContext(),
    );

    assert.equal(nextModel, model);
    assert.equal(commands.length, 1);
    assert.deepEqual(await commands[0](), { type: "toggle-perf" });
  }
});

test("ctrl-c still quits while startup file modal is open", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "c", ctrl: true, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      startupIntroComplete: true,
      startupFileModalOpen: true,
      startupFileModalInput: "read",
    }),
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.startupFileModalInput, "read");
  assert.equal(commands.length, 1);
  assert.equal(await commands[0](), QUIT);
});

test("ctrl-h cannot open a process-local Echo history pane", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const editor = mockEditor(editorMode, {
    pendingNormal: editorMode.PendingNormals.Delete,
  });

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "h", ctrl: true, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      editor,
      focusPane: "editor",
    }),
    mockKeyBindingContext(),
  );

  assert.equal(Object.hasOwn(nextModel, "historyDrawerOpen"), false);
  assert.equal(nextModel.focusPane, "editor");
  assert.deepEqual(commands, []);
});

test("plain q opens Bijou quit confirmation instead of quitting immediately", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);

  const [nextModel, commands] = keyBindings.updateFromKey(
    { type: "key", key: "q", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      editor: mockEditor(editorMode),
      focusPane: "editor",
    }),
    mockKeyBindingContext(),
  );

  assert.equal(nextModel.quitConfirmOpen, true);
  assert.deepEqual(commands, []);
});

test("Bijou quit confirmation accepts y and dismisses q without editor input", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    quitConfirmOpen: true,
  });

  const [accepted, quitCommands] = keyBindings.updateFromKey(
    { type: "key", key: "y", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const [dismissed, dismissCommands] = keyBindings.updateFromKey(
    { type: "key", key: "q", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(accepted.quitConfirmOpen, false);
  assert.equal(quitCommands.length, 1);
  assert.equal(dismissed.quitConfirmOpen, false);
  assert.deepEqual(dismissCommands, []);
});
