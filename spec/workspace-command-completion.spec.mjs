import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
  mockKeyBindingContext,
  mockTitleScreenModel,
  surfaceText,
} from "./workspace-helpers.mjs";

test("workspace command completion provider matches Vim command names and aliases", async () => {
  const completion = await importDist("app", "workspace", "command-completion.js");

  const empty = completion.workspaceCommandCompletionItems({
    input: "",
    cursorIndex: 0,
  });
  const writeQuery = completion.workspaceCommandCompletionItems({
    input: "w",
    cursorIndex: 1,
  });
  const quitAlias = completion.workspaceCommandCompletionItems({
    input: "q",
    cursorIndex: 1,
  });

  assert.deepEqual(
    empty.map((item) => item.label),
    ["edit", "write", "quit", "wq"],
  );
  assert.deepEqual(
    writeQuery.map((item) => item.label),
    ["write", "wq"],
  );
  assert.deepEqual(
    quitAlias.map((item) => item.label),
    ["quit"],
  );
  assert.deepEqual(writeQuery[0].replacement, {
    start: 0,
    end: 1,
    text: "write",
  });
});

test("workspace command completion provider hides file commands with no open file", async () => {
  const completion = await importDist("app", "workspace", "command-completion.js");

  const titleScreenItems = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "",
      cursorIndex: 0,
    },
    entries: [],
    hasOpenFile: false,
  });
  const writeQuery = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "w",
      cursorIndex: 1,
    },
    entries: [],
    hasOpenFile: false,
  });

  assert.deepEqual(
    titleScreenItems.map((item) => item.label),
    ["edit", "quit"],
  );
  assert.deepEqual(writeQuery, []);
});

test("workspace command completion provider localizes command copy", async () => {
  const completion = await importDist("app", "workspace", "command-completion.js");
  const requestedKeys = [];
  const i18n = {
    t(path) {
      requestedKeys.push(path);
      return `copy:${path}`;
    },
  };

  const items = completion.workspaceCommandCompletionItems(
    {
      input: "w",
      cursorIndex: 1,
    },
    i18n,
  );

  assert.deepEqual(
    items.map((item) => item.detail),
    [
      "copy:footer.command.details.write (w)",
      "copy:footer.command.details.wq (x)",
    ],
  );
  assert.deepEqual(requestedKeys, [
    "footer.command.details.write",
    "footer.command.details.wq",
  ]);
});

test("workspace command completion provider leaves argument text to later providers", async () => {
  const completion = await importDist("app", "workspace", "command-completion.js");

  const items = completion.workspaceCommandCompletionItems({
    input: "edit README.md",
    cursorIndex: 7,
  });

  assert.deepEqual(items, []);
});

test("workspace command line completion provider filters :edit files and directories", async () => {
  const [completion, fileSystem] = await Promise.all([
    importDist("app", "workspace", "command-completion.js"),
    importDist("ports", "file-system.js"),
  ]);

  const readme = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "edit R",
      cursorIndex: 6,
    },
    entries: editEntries(fileSystem),
  });
  const src = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "e s",
      cursorIndex: 3,
    },
    entries: editEntries(fileSystem),
  });
  const allEditEntries = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "edit ",
      cursorIndex: 5,
    },
    entries: editEntries(fileSystem),
  });
  const fuzzyReadme = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "edit rme",
      cursorIndex: 8,
    },
    entries: editEntries(fileSystem),
  });

  assert.deepEqual(
    readme.map((item) => item.label),
    ["README.md"],
  );
  assert.equal(readme[0].detail, "File");
  assert.equal(readme[0].kind, "file");
  assert.deepEqual(readme[0].replacement, {
    start: 5,
    end: 6,
    text: "README.md",
  });
  assert.deepEqual(
    src.map((item) => item.label),
    ["src/"],
  );
  assert.equal(src[0].detail, "Directory");
  assert.equal(src[0].kind, "directory");
  assert.deepEqual(src[0].replacement, {
    start: 2,
    end: 3,
    text: "src/",
  });
  assert.deepEqual(
    allEditEntries.map((item) => item.label),
    ["../", "src/", "README.md", "package.json"],
  );
  assert.deepEqual(
    fuzzyReadme.map((item) => item.label),
    ["README.md"],
  );
});

test("workspace command line completion provider returns bounded edit file previews", async () => {
  const [previewModule, fileSystem] = await Promise.all([
    importDist("app", "workspace", "command-completion-preview.js"),
    importDist("ports", "file-system.js"),
  ]);
  const previewCalls = [];

  const preview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
    entries: editEntries(fileSystem),
    maxPreviewLines: 2,
    previewSource: {
      loadFilePreview(filePath) {
        previewCalls.push(filePath);
        return {
          kind: previewModule.WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded,
          lines: ["alpha", "beta", "gamma"],
          evidencePosture: "fixture",
        };
      },
    },
  });

  assert.deepEqual(previewCalls, ["/repo/README.md"]);
  assert.equal(preview.kind, "file");
  assert.equal(preview.title, "README.md");
  assert.deepEqual(preview.lines, ["alpha", "beta"]);
  assert.equal(preview.evidencePosture, "fixture");
});

test("workspace command line completion provider reports unavailable edit previews", async () => {
  const [previewModule, fileSystem] = await Promise.all([
    importDist("app", "workspace", "command-completion-preview.js"),
    importDist("ports", "file-system.js"),
  ]);

  const unreadablePreview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
    entries: editEntries(fileSystem),
    previewSource: {
      loadFilePreview() {
        return {
          kind: previewModule.WORKSPACE_FILE_PREVIEW_RESULT_KIND.Unavailable,
          reason: "Unreadable file",
          evidencePosture: "fixture-unavailable",
        };
      },
    },
  });
  const directoryPreview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "e ",
      cursorIndex: 2,
      selectedCompletionIndex: 1,
    },
    entries: editEntries(fileSystem),
  });

  assert.equal(unreadablePreview.kind, "unavailable");
  assert.deepEqual(unreadablePreview.lines, ["Unreadable file"]);
  assert.equal(unreadablePreview.evidencePosture, "fixture-unavailable");
  assert.equal(directoryPreview.kind, "unavailable");
  assert.deepEqual(directoryPreview.lines, ["Directory preview unavailable"]);
  assert.equal(directoryPreview.evidencePosture, "unavailable");
});

test("command-line mode moves and accepts command completions", async () => {
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

  const [down] = keyBindings.updateFromKey(
    { type: "key", key: "down", ctrl: false, alt: false, shift: false },
    base,
    context,
  );
  const [up] = keyBindings.updateFromKey(
    { type: "key", key: "up", ctrl: false, alt: false, shift: false },
    down,
    context,
  );
  const [accepted, commands] = keyBindings.updateFromKey(
    { type: "key", key: "tab", ctrl: false, alt: false, shift: false },
    {
      ...base,
      commandLine: {
        active: true,
        input: "e",
        cursorIndex: 1,
        selectedCompletionIndex: 0,
      },
    },
    context,
  );

  assert.equal(down.commandLine.selectedCompletionIndex, 1);
  assert.equal(up.commandLine.selectedCompletionIndex, 0);
  assert.equal(accepted.commandLine.input, "edit ");
  assert.equal(accepted.commandLine.cursorIndex, 5);
  assert.equal(accepted.commandLine.selectedCompletionIndex, 0);
  assert.deepEqual(commands, []);
});

test("command-line mode accepts changing completions with enter before dispatch", async () => {
  const [keyBindings, titleScreen, editorMode, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("ports", "file-system.js"),
  ]);
  const context = mockKeyBindingContext();
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    entries: editEntries(fileSystem),
    commandLine: {
      active: true,
      input: "e",
      cursorIndex: 1,
      selectedCompletionIndex: 0,
    },
  });

  const [acceptedCommand, commandCommands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  const [acceptedFile, fileCommands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    {
      ...acceptedCommand,
      commandLine: {
        ...acceptedCommand.commandLine,
        input: "edit R",
        cursorIndex: 6,
      },
    },
    context,
  );

  assert.equal(acceptedCommand.commandLine.input, "edit ");
  assert.equal(acceptedCommand.commandLine.cursorIndex, 5);
  assert.deepEqual(commandCommands, []);
  assert.equal(acceptedFile.commandLine.input, "edit README.md");
  assert.equal(acceptedFile.commandLine.cursorIndex, 14);
  assert.deepEqual(fileCommands, []);
});

test("command-line mode accepts edit file completions", async () => {
  const [keyBindings, titleScreen, editorMode, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    entries: editEntries(fileSystem),
    commandLine: {
      active: true,
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
  });

  const [accepted, commands] = keyBindings.updateFromKey(
    { type: "key", key: "tab", ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(accepted.commandLine.input, "edit README.md");
  assert.equal(accepted.commandLine.cursorIndex, 14);
  assert.equal(accepted.commandLine.selectedCompletionIndex, 0);
  assert.deepEqual(commands, []);
});

test("workspace render paints command completions above the Vim command line", async () => {
  const [viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 18,
    editor: mockEditor(editorMode, { lines: ["hello world"] }),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: workspaceRenderTheme(),
    commandLine: {
      active: true,
      input: "e",
      cursorIndex: 1,
      selectedCompletionIndex: 0,
    },
  });

  const lines = surfaceText(viewer.renderWorkspace(model)).split("\n");

  assert.equal(viewer.renderWorkspace(model).get(1, 15).char, "›");
  assert.match(lines[15], /› edit\s+cmd\s+Open a file/);
  assert.match(lines[16], /^:e\s*$/);
});

test("workspace render omits write completions on the title screen", async () => {
  const [viewer, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 18,
    editor: undefined,
    footerVisible: true,
    jeditTheme: workspaceRenderTheme(),
    commandLine: {
      active: true,
      input: "",
      cursorIndex: 0,
      selectedCompletionIndex: 0,
    },
  });

  const lines = surfaceText(viewer.renderWorkspace(model)).split("\n");
  const completionText = lines.slice(12, 16).join("\n");

  assert.match(completionText, /› edit\s+cmd\s+Open a file/);
  assert.match(completionText, /quit\s+cmd\s+Quit jedit/);
  assert.doesNotMatch(completionText, /write\s+cmd\s+Write the current file/);
  assert.doesNotMatch(completionText, /wq\s+cmd\s+Write and quit/);
});

test("workspace render pins command completions to the original command anchor", async () => {
  const [viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 18,
    editor: mockEditor(editorMode, { lines: ["hello world"] }),
    focusPane: "editor",
    footerVisible: true,
    jeditTheme: workspaceRenderTheme(),
    commandLine: {
      active: true,
      input: "edi",
      cursorIndex: 3,
      anchorCursorIndex: 0,
      selectedCompletionIndex: 0,
    },
  });

  const surface = viewer.renderWorkspace(model);

  assert.equal(surface.get(1, 15).char, "›");
  assert.notEqual(surface.get(4, 15).char, "›");
});

test("workspace render paints edit file completions above the Vim command line", async () => {
  const [viewer, titleScreen, editorMode, fileSystem] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("ports", "file-system.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 18,
    editor: mockEditor(editorMode, { lines: ["hello world"] }),
    focusPane: "editor",
    footerVisible: true,
    entries: editEntries(fileSystem),
    jeditTheme: workspaceRenderTheme(),
    commandLine: {
      active: true,
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
  });

  const lines = surfaceText(viewer.renderWorkspace(model)).split("\n");

  assert.match(lines[13], /› README\.md\s+file\s+File/);
  assert.match(lines[13], /NONE README\.md/);
  assert.match(lines[14], /Evidence: unavailable/);
  assert.match(lines[16], /^:edit R\s*$/);
});

function editEntries(fileSystem) {
  return [
    {
      kind: fileSystem.FileEntryKinds.Parent,
      name: "..",
      path: "/repo/..",
    },
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
    {
      kind: fileSystem.FileEntryKinds.File,
      name: "package.json",
      path: "/repo/package.json",
    },
  ];
}

function workspaceRenderTheme() {
  const workspace = token("#f0f6fc", "#0d1117");
  const drawer = token("#c9d1d9", "#161b22");
  const footer = token("#c9d1d9", "#0b1016");
  const normal = token("#0d1117", "#58a6ff");
  const insert = token("#0d1117", "#7ee787");
  const edge = { ...token("#58a6ff", "#0d1117"), char: "│" };

  return {
    name: "test",
    mode: "dark",
    familyName: "test",
    variantSource: "authored",
    variables: new Map(),
    source: new Map(),
    sourceRoleMap: new Map(),
    markdown: new Map(),
    surface: {
      workspace,
      drawer,
      footer,
    },
    cursor: {
      normal,
      insert,
    },
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
