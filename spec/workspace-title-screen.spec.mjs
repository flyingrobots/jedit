import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockDeps,
  mockI18n,
  mockKeyBindingContext,
  mockTitleScreenModel,
  surfaceText,
} from "./workspace-helpers.mjs";

const STARTUP_MODAL_OVERFLOW_ENTRY_COUNT = 10;
const STARTUP_MODAL_SCROLL_SELECTED_INDEX = 8;
const STARTUP_MODAL_SCROLLBAR_TRACK_CHAR = "│";
const STARTUP_MODAL_SCROLLBAR_THUMB_CHAR = "█";

test("tab skips startup intro without opening the file browser", async () => {
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
  const rendered = viewerContent.renderViewer(opened, 80, 24);
  assert.ok(rendered.width > 0);

  assert.equal(opened.startupIntroComplete, true);
  assert.equal(opened.startupFileModalOpen, false);
  assert.equal(commands.length, 0);
});

test("startup file modal shortcuts defer to the active title command line", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const introModel = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: false,
    startupFileModalOpen: false,
    commandLine: activeTitleCommandLine("e"),
  });
  const reopenedModel = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: true,
    startupFileModalOpen: false,
    commandLine: activeTitleCommandLine("e"),
  });

  const [tabbed, tabCommands] = keyBindings.updateFromKey(
    { key: "tab", ctrl: false, alt: false, shift: false },
    introModel,
    startupFileDrawerAnimationContext(),
  );
  const [entered, enterCommands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    reopenedModel,
    startupFileDrawerAnimationContext(),
  );

  assert.equal(tabbed.startupIntroComplete, false);
  assert.equal(tabbed.startupFileModalOpen, false);
  assert.equal(tabbed.commandLine.input, "edit ");
  assert.deepEqual(tabCommands, []);
  assert.equal(entered.startupIntroComplete, true);
  assert.equal(entered.startupFileModalOpen, false);
  assert.equal(entered.commandLine.input, "edit ");
  assert.deepEqual(enterCommands, []);
});

test("feedback module exposes notification presentation tokens", async () => {
  const feedback = await importDist("ui", "feedback.js");

  assert.equal(feedback.NotificationVariants.Toast, "TOAST");
  assert.equal(feedback.NotificationTones.Info, "INFO");
  assert.equal(feedback.NotificationPlacements.LowerRight, "LOWER_RIGHT");
});

test("enter skips title intro without opening the startup file browser", async () => {
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
  assert.equal(entered.startupFileModalOpen, false);
  assert.equal(enterCommands.length, 0);
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

test("workspace title row uses the active theme chrome token", async () => {
  const [viewer, titleScreen, themes] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("ui", "jedit-themes.js"),
  ]);
  const theme = themes.availableJeditThemes()[0];
  const surface = viewer.renderWorkspace(mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 24,
    jeditTheme: theme,
    startupIntroComplete: true,
    editor: {
      path: "/repo/foo.txt",
      lines: ["themed title"],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: true,
      readOnly: false,
      mode: "normal",
    },
  }));
  const titleCells = Array.from({ length: surface.width }, (_, x) => surface.get(x, 0));
  const titleCell = titleCells.find((cell) => cell.char !== " ");

  assert.ok(titleCell);
  assert.equal(titleCell.bg, theme.surface.header.bg);
  assert.equal(titleCell.fg, theme.surface.header.fg);
  assert.ok(
    titleCells.every((cell) => cell.bg === theme.surface.header.bg),
    "the complete title row should use the header surface",
  );
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

test("startup file modal no longer owns printable type-to-search input", async () => {
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

  const [ignored] = keyBindings.updateFromKey(
    { key: "n", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const text = surfaceText(viewer.renderWorkspace(ignored));

  assert.equal(ignored.startupFileModalInput, "");
  assert.match(text, /notes\.txt/);
  assert.match(text, /alpha\.tmp/);
});

test("startup file modal stays closed after Escape dismissal", async () => {
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
  const [enterIgnored, enterCommands] = keyBindings.updateFromKey(
    { key: "enter", ctrl: false, alt: false, shift: false },
    closed,
    startupFileDrawerAnimationContext(),
  );
  const [openIgnored, openCommands] = keyBindings.updateFromKey(
    { key: "o", ctrl: false, alt: false, shift: false },
    enterIgnored,
    startupFileDrawerAnimationContext(),
  );
  const [tabIgnored, tabCommands] = keyBindings.updateFromKey(
    { key: "tab", ctrl: false, alt: false, shift: false },
    openIgnored,
    startupFileDrawerAnimationContext(),
  );

  assert.equal(closed.startupFileModalOpen, false);
  assert.equal(closed.startupFileDrawerProgress, 1);
  assert.equal(enterIgnored.startupFileModalOpen, false);
  assert.equal(openIgnored.startupFileModalOpen, false);
  assert.equal(tabIgnored.startupFileModalOpen, false);
  assert.equal(closeCommands.length, 1);
  assert.equal(enterCommands.length, 0);
  assert.equal(openCommands.length, 0);
  assert.equal(tabCommands.length, 0);
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
          resolve: (...parts) => parts.join("/"),
        },
      }),
    }),
  );

  assert.equal(opened.cwd, "/repo/src");
  assert.deepEqual(opened.entries, [childEntry]);
  assert.equal(opened.startupFileModalOpen, true);
  assert.equal(opened.startupFileModalInput, "src");
  assert.deepEqual(commands, []);
});

test("startup file modal renders empty state without search no-match posture", async () => {
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
  const seededInputText = surfaceText(
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
  assert.doesNotMatch(seededInputText, /No files match/);
  assert.match(seededInputText, /notes\.md/);
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

function activeTitleCommandLine(input) {
  return {
    active: true,
    input,
    cursorIndex: input.length,
    anchorCursorIndex: 0,
    selectedCompletionIndex: 0,
  };
}
