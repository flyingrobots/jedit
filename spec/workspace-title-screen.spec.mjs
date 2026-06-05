import assert from "node:assert/strict";
import test from "node:test";
import { stringToSurface } from "@flyingrobots/bijou";
import {
  hasNotification,
  importDist,
  mockDeps,
  mockI18n,
  mockKeyBindingContext,
  mockTitleScreenModel,
  notification,
  surfaceText,
} from "./workspace-helpers.mjs";

const STARTUP_MODAL_OVERFLOW_ENTRY_COUNT = 10;
const STARTUP_MODAL_SCROLL_SELECTED_INDEX = 8;
const STARTUP_MODAL_SCROLLBAR_TRACK_CHAR = "│";
const STARTUP_MODAL_SCROLLBAR_THUMB_CHAR = "█";

test("title screen number keys switch render modes without an editor", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const [asciiModel] = keyBindings.updateFromKey(
    { key: "2" },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
    }),
    mockKeyBindingContext(),
  );
  const [brailleModel] = keyBindings.updateFromKey(
    { key: "1" },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii,
    }),
    mockKeyBindingContext(),
  );

  assert.equal(asciiModel.titleRenderMode, titleScreen.TITLE_RENDER_MODE.Ascii);
  assert.equal(
    brailleModel.titleRenderMode,
    titleScreen.TITLE_RENDER_MODE.Braille,
  );
  assert.equal(
    hasNotification(asciiModel, "Title shader", "ASCII · Dense"),
    true,
  );
  assert.equal(hasNotification(brailleModel, "Title shader", "Braille"), true);
  assert.equal(
    notification(asciiModel, "Title shader", "ASCII · Dense").placement,
    "LOWER_RIGHT",
  );
  assert.deepEqual(
    notification(asciiModel, "Title shader", "ASCII · Dense").bgToken,
    {
      hex: "#f0f6fc",
      bg: "#0d1117",
    },
  );
  assert.deepEqual(
    notification(asciiModel, "Title shader", "ASCII · Dense").accentToken,
    {
      hex: "#58a6ff",
      bg: "#0d1117",
    },
  );
});

test("tab opens startup file browser and suppresses title logos", async () => {
  const [keyBindings, titleScreen, viewerContent] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "viewer-content.js"),
  ]);
  const base = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });
  const [opened, commands] = keyBindings.updateFromKey(
    { key: "tab", ctrl: false, alt: false, shift: false },
    base,
    startupFileDrawerAnimationContext(),
  );
  const renderOptions = [];

  viewerContent.renderViewerWithTitleRenderer(
    opened,
    44,
    8,
    (width, height, _time, _theme, options) => {
      renderOptions.push(options);
      return stringToSurface("title trace", width, height);
    },
  );

  assert.equal(opened.startupIntroComplete, true);
  assert.equal(opened.startupFileModalOpen, true);
  assert.equal(commands.length, 1);
  assert.equal(renderOptions[0].suppressPresentation, true);
});

test("title screen m cycles Dragon materials and reports the material name", async () => {
  const [keyBindings, titleScreen, material, sceneLoader, meshes] =
    await Promise.all([
      importDist("app", "workspace", "key-bindings.js"),
      importDist("ui", "title-screen.js"),
      importDist("app", "workspace", "title-dragon-materials.js"),
      importDist("adapters", "title-scene-loader.js"),
      importDist("adapters", "workspace-title-meshes.js"),
    ]);
  const scene = await sceneLoader.loadBuiltInTitleScene(
    "neon-dispersion.jedit-scene",
    meshes.loadStartupTitleMeshes(),
  );
  const [first] = keyBindings.updateFromKey(
    { key: "m", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, { sceneOverride: scene }),
    mockKeyBindingContext(),
  );
  const [second] = keyBindings.updateFromKey(
    { key: "M", ctrl: false, alt: false, shift: true },
    first,
    mockKeyBindingContext(),
  );
  const firstPreset = material.titleDragonMaterialPresetAt(1);
  const secondPreset = material.titleDragonMaterialPresetAt(2);

  assert.equal(first.titleDragonMaterialIndex, 1);
  assert.deepEqual(first.sceneOverride.objects[0].color, firstPreset.color);
  assert.equal(
    hasNotification(first, "Dragon material", firstPreset.name),
    true,
  );
  assert.equal(second.titleDragonMaterialIndex, 2);
  assert.deepEqual(second.sceneOverride.objects[0].color, secondPreset.color);
  assert.equal(
    hasNotification(second, "Dragon material", secondPreset.name),
    true,
  );
});

test("feedback module exposes notification presentation tokens", async () => {
  const feedback = await importDist("ui", "feedback.js");

  assert.equal(feedback.NotificationVariants.Toast, "TOAST");
  assert.equal(feedback.NotificationTones.Info, "INFO");
  assert.equal(feedback.NotificationPlacements.LowerRight, "LOWER_RIGHT");
});

test("title screen rejects unknown ASCII palettes instead of surfacing them in toast text", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);

  assert.throws(
    () =>
      keyBindings.updateFromKey(
        { key: "2" },
        mockTitleScreenModel(titleScreen, {
          titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
          titleAsciiPalette: "future-palette",
        }),
        mockKeyBindingContext(),
      ),
    (error) => error?.name === "InvalidTitleAsciiPaletteError",
  );
});

test("period cycles title screen ASCII palettes only when ASCII mode is active without an editor", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const [ignoredModel, ignoredCommands] = keyBindings.updateFromKey(
    { key: "." },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
      titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    }),
    mockKeyBindingContext(),
  );
  const [firstModel] = keyBindings.updateFromKey(
    { key: "." },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii,
      titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    }),
    mockKeyBindingContext(),
  );
  const [secondModel] = keyBindings.updateFromKey(
    { key: "." },
    firstModel,
    mockKeyBindingContext(),
  );

  assert.equal(
    ignoredModel.titleRenderMode,
    titleScreen.TITLE_RENDER_MODE.Braille,
  );
  assert.equal(
    ignoredModel.titleAsciiPalette,
    titleScreen.TITLE_ASCII_PALETTE.Dense,
  );
  assert.equal(ignoredModel.notifications.items.length, 0);
  assert.equal(ignoredCommands.length, 0);
  assert.equal(firstModel.titleRenderMode, titleScreen.TITLE_RENDER_MODE.Ascii);
  assert.equal(
    firstModel.titleAsciiPalette,
    titleScreen.TITLE_ASCII_PALETTE.Minimal,
  );
  assert.equal(
    secondModel.titleAsciiPalette,
    titleScreen.TITLE_ASCII_PALETTE.Technical,
  );
  assert.equal(hasNotification(firstModel, "ASCII palette", "Minimal"), true);
  assert.equal(
    hasNotification(secondModel, "ASCII palette", "Technical"),
    true,
  );
  assert.equal(
    notification(firstModel, "ASCII palette", "Minimal").placement,
    "LOWER_RIGHT",
  );
});

test("enter skips title intro into the startup file browser", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const base = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });

  const [entered, enterCommands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    base,
    startupFileDrawerAnimationContext(),
  );

  assert.equal(entered.startupIntroComplete, true);
  assert.equal(entered.startupFileModalOpen, true);
  assert.equal(enterCommands.length, 1);
});

test("escape opens quit confirmation when startup file browser is closed", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const [nextModel, commands] = keyBindings.updateFromKey(
    { key: "escape", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      startupIntroComplete: false,
      startupFileModalOpen: false,
    }),
    startupFileDrawerAnimationContext(),
  );

  assert.equal(nextModel.quitConfirmOpen, true);
  assert.equal(nextModel.startupIntroComplete, false);
  assert.equal(nextModel.startupFileModalOpen, false);
  assert.equal(commands.length, 0);
});

test("escape dismisses open startup file browser with a drawer animation", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const [closed, commands] = keyBindings.updateFromKey(
    { key: "escape", ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      startupIntroComplete: true,
      startupFileModalOpen: true,
      startupFileDrawerProgress: 1,
    }),
    startupFileDrawerAnimationContext(),
  );

  assert.equal(closed.startupFileModalOpen, false);
  assert.equal(closed.startupFileDrawerProgress, 1);
  assert.equal(closed.quitConfirmOpen, false);
  assert.equal(commands.length, 1);
});

test("startup file browser keeps tracing the title scene while input changes", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const tracedTimes = [];
  const titleRenderer = (width, height, time) => {
    tracedTimes.push(time);
    return stringToSurface(
      `trace ${tracedTimes.length} time ${time}`,
      width,
      height,
    );
  };
  const base = mockTitleScreenModel(titleScreen, {
    time: 1,
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });
  const renderer = viewerContent.createViewerContentRenderer(titleRenderer);

  const live = renderer.renderViewer(base, 44, 6);
  const openModal = renderer.renderViewer(
    {
      ...base,
      time: 7,
      startupIntroComplete: true,
      startupFileModalOpen: true,
    },
    44,
    6,
  );
  const typed = renderer.renderViewer(
    {
      ...base,
      time: 8,
      startupIntroComplete: true,
      startupFileModalOpen: true,
      startupFileModalInput: "read",
    },
    44,
    6,
  );

  assert.deepEqual(tracedTimes, [1, 7, 8]);
  assert.notEqual(surfaceText(openModal), surfaceText(live));
  assert.notEqual(surfaceText(typed), surfaceText(openModal));
});

test("startup file browser traces every frame when no title cache exists", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const tracedTimes = [];
  const titleRenderer = (width, height, time) => {
    tracedTimes.push(time);
    return stringToSurface(
      `fallback ${tracedTimes.length} time ${time}`,
      width,
      height,
    );
  };
  const model = mockTitleScreenModel(titleScreen, {
    time: 7,
    startupIntroComplete: true,
    startupFileModalOpen: true,
  });
  const renderer = viewerContent.createViewerContentRenderer(titleRenderer);

  const first = renderer.renderViewer(model, 44, 6);
  const second = renderer.renderViewer(
    {
      ...model,
      time: 8,
      startupFileModalInput: "r",
    },
    44,
    6,
  );

  assert.deepEqual(tracedTimes, [7, 8]);
  assert.notEqual(surfaceText(second), surfaceText(first));
});

test("startup file browser title renderer state is isolated per renderer instance", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const firstRenderer = viewerContent.createViewerContentRenderer(
    (width, height) => stringToSurface("session one", width, height),
  );
  const secondRenderer = viewerContent.createViewerContentRenderer(
    (width, height) => stringToSurface("session two", width, height),
  );
  const base = mockTitleScreenModel(titleScreen, {
    time: 1,
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });

  firstRenderer.renderViewer(base, 44, 6);
  const second = secondRenderer.renderViewer(
    {
      ...base,
      time: 7,
      startupIntroComplete: true,
      startupFileModalOpen: true,
    },
    44,
    6,
  );

  assert.match(surfaceText(second), /session two/);
  assert.doesNotMatch(surfaceText(second), /session one/);
});

test("startup intro skip does not interrupt focused file drawer open", async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    fileDrawerOpen: true,
    focusPane: "files",
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "notes.md",
        path: "/repo/notes.md",
      },
    ],
  });

  const [opened, commands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ deps: mockDeps() }),
  );

  assert.equal(opened.startupIntroComplete, false);
  assert.equal(opened.startupFileModalOpen, false);
  assert.equal(opened.textAuthority.kind, "pending-open");
  assert.equal(opened.textAuthority.filePath, "/repo/notes.md");
  assert.equal(commands.length, 1);
});

test("startup file modal renders current directory files over the title screen", async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 12,
    i18n: mockI18n(),
    cwd: "/repo",
    workspaceRoot: "/repo",
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    startupFileModalInput: "",
    startupFileModalSelectedIndex: 0,
    entries: [
      {
        kind: fileSystem.FileEntryKinds.Directory,
        name: "src",
        path: "/repo/src",
      },
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "README.md",
        path: "/repo/README.md",
      },
    ],
  });
  const text = surfaceText(viewer.renderWorkspace(model));

  assert.match(text, /Open file/);
  assert.match(text, /\/repo/);
  assert.match(text, /src\//);
  assert.match(text, /README\.md/);
});

test("startup file selector renders as a left drawer over the title screen", async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    i18n: mockI18n(),
    cwd: "/repo",
    workspaceRoot: "/repo",
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "README.md",
        path: "/repo/README.md",
      },
    ],
  });
  const surface = viewer.renderWorkspace(model);
  const text = surfaceText(surface);

  assert.equal(surface.get(0, 2).char, "┌");
  assert.match(text, /Open file/);
  assert.match(text, /README\.md/);
});

test("startup file selector drawer width follows spring progress", async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("ports", "file-system.js"),
  ]);
  const base = {
    i18n: mockI18n(),
    cwd: "/repo",
    workspaceRoot: "/repo",
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "README.md",
        path: "/repo/README.md",
      },
    ],
  };
  const closed = viewer.renderWorkspace(
    mockTitleScreenModel(titleScreen, {
      ...base,
      startupFileDrawerProgress: 0,
    }),
  );
  const opening = viewer.renderWorkspace(
    mockTitleScreenModel(titleScreen, {
      ...base,
      startupFileDrawerProgress: 0.5,
    }),
  );
  const closing = viewer.renderWorkspace(
    mockTitleScreenModel(titleScreen, {
      ...base,
      startupFileModalOpen: false,
      startupFileDrawerProgress: 0.5,
    }),
  );

  assert.notEqual(closed.get(0, 2).char, "┌");
  assert.equal(opening.get(0, 2).char, "┌");
  assert.equal(closing.get(0, 2).char, "┌");
  assert.notEqual(opening.get(71, 2).char, "┐");
});

test("startup file modal renders a themed Bijou scrollbar when file rows overflow", async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("ports", "file-system.js"),
  ]);
  const theme = themes.availableJeditThemes()[0];
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 12,
    i18n: mockI18n(),
    cwd: "/repo",
    workspaceRoot: "/repo",
    jeditTheme: theme,
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    startupFileModalInput: "",
    startupFileModalSelectedIndex: STARTUP_MODAL_SCROLL_SELECTED_INDEX,
    entries: startupModalOverflowEntries(fileSystem),
  });
  const rendered = viewer.renderWorkspace(model);

  const scrollbarCells = startupModalScrollbarCells(rendered);
  const selectedRowCells = startupModalRowCells(rendered, /file-08\.md/);

  assert.ok(scrollbarCells.length > 0);
  assert.ok(
    scrollbarCells.some(
      ({ cell }) => cell.char === STARTUP_MODAL_SCROLLBAR_THUMB_CHAR,
    ),
  );
  assert.ok(
    scrollbarCells.every(({ cell }) => cell.fg === theme.chrome.activeEdge.fg),
  );
  assert.ok(
    scrollbarCells.every(({ cell }) => cell.bg === theme.surface.drawer.bg),
  );
  assert.ok(
    selectedRowCells.some(({ cell }) => cell.bg === theme.cursor.normal.bg),
  );
});

test("startup file modal input filters current directory rows", async () => {
  const [keyBindings, viewer, titleScreen, themes, fileSystem] =
    await Promise.all([
      importDist("app", "workspace", "key-bindings.js"),
      importDist("app", "workspace", "viewer.js"),
      importDist("ui", "title-screen.js"),
      importDist("ui", "jedit-themes.js"),
      importDist("ports", "file-system.js"),
    ]);
  const model = mockTitleScreenModel(titleScreen, {
    i18n: mockI18n(),
    cwd: "/repo",
    workspaceRoot: "/repo",
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    startupFileModalInput: "",
    startupFileModalSelectedIndex: 0,
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "notes.txt",
        path: "/repo/notes.txt",
      },
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "alpha.tmp",
        path: "/repo/alpha.tmp",
      },
    ],
  });

  const [filtered] = keyBindings.updateFromKey(
    { key: "n", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const text = surfaceText(viewer.renderWorkspace(filtered));

  assert.equal(filtered.startupFileModalInput, "n");
  assert.match(text, /notes\.txt/);
  assert.doesNotMatch(text, /alpha\.tmp/);
});

test("startup file modal can be reopened from the title screen after Escape dismissal", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const open = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
  });

  const [closed, closeCommands] = keyBindings.updateFromKey(
    { key: "escape", ctrl: false, alt: false, shift: false },
    open,
    startupFileDrawerAnimationContext(),
  );
  const [reopenedByEnter, enterCommands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    closed,
    startupFileDrawerAnimationContext(),
  );
  const [closedAgain] = keyBindings.updateFromKey(
    { key: "escape", ctrl: false, alt: false, shift: false },
    reopenedByEnter,
    mockKeyBindingContext(),
  );
  const [reopenedByOpen, openCommands] = keyBindings.updateFromKey(
    { key: "o", ctrl: false, alt: false, shift: false },
    closedAgain,
    startupFileDrawerAnimationContext(),
  );
  const [closedAfterOpen] = keyBindings.updateFromKey(
    { key: "escape", ctrl: false, alt: false, shift: false },
    reopenedByOpen,
    startupFileDrawerAnimationContext(),
  );
  const [reopenedByTab, tabCommands] = keyBindings.updateFromKey(
    { key: "tab", ctrl: false, alt: false, shift: false },
    closedAfterOpen,
    startupFileDrawerAnimationContext(),
  );

  assert.equal(closed.startupFileModalOpen, false);
  assert.equal(closed.startupFileDrawerProgress, 1);
  assert.equal(reopenedByEnter.startupFileModalOpen, true);
  assert.equal(reopenedByOpen.startupFileModalOpen, true);
  assert.equal(reopenedByTab.startupFileModalOpen, true);
  assert.equal(closeCommands.length, 1);
  assert.equal(enterCommands.length, 1);
  assert.equal(openCommands.length, 1);
  assert.equal(tabCommands.length, 1);
});

test("startup file modal enter opens the selected file through production text authority", async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    cwd: "/repo",
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    startupFileModalInput: "",
    startupFileModalSelectedIndex: 0,
    textRequestId: 0,
    textRuntimeProfile: "echoHosted",
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "notes.md",
        path: "/repo/notes.md",
      },
    ],
  });

  const [opened, commands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ deps: mockDeps() }),
  );

  assert.equal(opened.startupFileModalOpen, false);
  assert.equal(opened.textAuthority.kind, "pending-open");
  assert.equal(opened.textAuthority.filePath, "/repo/notes.md");
  assert.equal(commands.length, 1);
});

test("startup file modal navigation keeps the selected row bounded", async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: true,
    startupFileModalOpen: true,
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "alpha.md",
        path: "/repo/alpha.md",
      },
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "beta.md",
        path: "/repo/beta.md",
      },
    ],
  });

  const [down] = keyBindings.updateFromKey(
    { key: "down", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const [pastEnd] = keyBindings.updateFromKey(
    { key: "j", ctrl: false, alt: false, shift: false },
    down,
    mockKeyBindingContext(),
  );
  const [up] = keyBindings.updateFromKey(
    { key: "up", ctrl: false, alt: false, shift: false },
    pastEnd,
    mockKeyBindingContext(),
  );

  assert.equal(down.startupFileModalSelectedIndex, 1);
  assert.equal(pastEnd.startupFileModalSelectedIndex, 1);
  assert.equal(up.startupFileModalSelectedIndex, 0);
});

test("startup file modal opens directories without dismissing the modal", async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("ports", "file-system.js"),
  ]);
  const childEntry = {
    kind: fileSystem.FileEntryKinds.File,
    name: "child.md",
    path: "/repo/src/child.md",
  };
  const model = mockTitleScreenModel(titleScreen, {
    cwd: "/repo",
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    startupFileModalInput: "src",
    entries: [
      {
        kind: fileSystem.FileEntryKinds.Directory,
        name: "src",
        path: "/repo/src",
      },
    ],
  });

  const [opened, commands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({
      deps: mockDeps({
        fileSystem: {
          loadEntries: () => [childEntry],
          describeDirectoryIssue: () => ({
            title: "test",
            message: "not implemented",
          }),
          dirname: () => "/repo",
          join: (...parts) => parts.join("/"),
        },
      }),
    }),
  );

  assert.equal(opened.cwd, "/repo/src");
  assert.deepEqual(opened.entries, [childEntry]);
  assert.equal(opened.startupFileModalOpen, true);
  assert.equal(opened.startupFileModalInput, "");
  assert.deepEqual(commands, []);
});

test("startup file modal renders empty and no-match states", async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("ports", "file-system.js"),
  ]);
  const base = {
    i18n: mockI18n(),
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
  };
  const emptyText = surfaceText(
    viewer.renderWorkspace(
      mockTitleScreenModel(titleScreen, {
        ...base,
        entries: [],
      }),
    ),
  );
  const noMatchText = surfaceText(
    viewer.renderWorkspace(
      mockTitleScreenModel(titleScreen, {
        ...base,
        startupFileModalInput: "z",
        entries: [
          {
            kind: fileSystem.FileEntryKinds.File,
            name: "notes.md",
            path: "/repo/notes.md",
          },
        ],
      }),
    ),
  );

  assert.match(emptyText, /No files in this directory/);
  assert.match(noMatchText, /No files match/);
});

test("startup file modal does not override the small-terminal notice", async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 40,
    rows: 8,
    i18n: { direction: "ltr" },
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileDrawerProgress: 1,
    entries: [
      {
        kind: fileSystem.FileEntryKinds.File,
        name: "notes.md",
        path: "/repo/notes.md",
      },
    ],
  });
  const text = surfaceText(viewer.renderWorkspace(model));

  assert.match(text, /need at least/);
  assert.doesNotMatch(text, /Open file/);
});

function startupModalOverflowEntries(fileSystem) {
  return Array.from(
    { length: STARTUP_MODAL_OVERFLOW_ENTRY_COUNT },
    (_, index) => ({
      kind: fileSystem.FileEntryKinds.File,
      name: `file-${String(index).padStart(2, "0")}.md`,
      path: `/repo/file-${String(index).padStart(2, "0")}.md`,
    }),
  );
}

function startupModalScrollbarCells(surface) {
  const thumb = positionedCells(surface).find(
    ({ cell }) => cell.char === STARTUP_MODAL_SCROLLBAR_THUMB_CHAR,
  );
  if (thumb == null) {
    return [];
  }
  return positionedCells(surface).filter(
    ({ x, cell }) =>
      x === thumb.x &&
      (cell.char === STARTUP_MODAL_SCROLLBAR_TRACK_CHAR ||
        cell.char === STARTUP_MODAL_SCROLLBAR_THUMB_CHAR),
  );
}

function startupModalRowCells(surface, pattern) {
  const row = surfaceText(surface)
    .split("\n")
    .findIndex((line) => pattern.test(line));
  assert.notEqual(row, -1);
  return positionedCells(surface).filter(({ y }) => y === row);
}

function positionedCells(surface) {
  return Array.from({ length: surface.height }, (_, y) =>
    Array.from({ length: surface.width }, (_, x) => ({
      x,
      y,
      cell: surface.get(x, y),
    })),
  ).flat();
}

function startupFileDrawerAnimationContext() {
  return mockKeyBindingContext({
    createStartupFileDrawerAnimationCmd: (_from, to) => [
      () => ({ type: "startup-file-drawer-progress", value: to }),
    ],
  });
}
