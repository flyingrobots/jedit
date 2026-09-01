import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
  mockGutterTokens,
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
  const whyQuery = completion.workspaceCommandCompletionItems({
    input: "why",
    cursorIndex: 3,
  });

  assert.deepEqual(
    empty.map((item) => item.label),
    ["edit", "write", "quit", "wq", "ttd", "strand", "braid", "why", "help"],
  );
  assert.deepEqual(
    writeQuery.map((item) => item.label),
    ["write", "wq", "why"],
  );
  assert.deepEqual(
    quitAlias.map((item) => item.label),
    ["quit"],
  );
  assert.deepEqual(
    whyQuery.map((item) => [item.label, item.detail]),
    [["why", "Explain the last meaningful command"]],
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
    ["edit", "quit", "ttd", "strand", "braid", "why", "help"],
  );
  assert.deepEqual(
    writeQuery.map((item) => item.label),
    ["why"],
  );
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
      "copy:footer.command.details.why",
    ],
  );
  assert.deepEqual(requestedKeys, [
    "footer.command.details.write",
    "footer.command.details.wq",
    "footer.command.details.why",
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

test("workspace command line completion provider suggests worldline command arguments", async () => {
  const completion = await importDist("app", "workspace", "command-completion.js");

  const strandItems = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "strand ",
      cursorIndex: 7,
      selectedCompletionIndex: 0,
    },
    entries: [],
  });
  const braidItems = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "braid pr",
      cursorIndex: 8,
      selectedCompletionIndex: 0,
    },
    entries: [],
  });

  assert.deepEqual(
    strandItems.map((item) => [item.label, item.detail]),
    [
      ["list", "Show worldline graph"],
      ["new from here", "Fork from current basis"],
      ["switch main", "Switch back to main"],
    ],
  );
  assert.deepEqual(strandItems[1].replacement, {
    start: 7,
    end: 7,
    text: "new from here",
  });
  assert.deepEqual(
    braidItems.map((item) => item.label),
    ["preview"],
  );
});

test("workspace command line completion preview documents commands and arguments", async () => {
  const [completion, preview] = await Promise.all([
    importDist("app", "workspace", "command-completion.js"),
    importDist("app", "workspace", "command-completion-preview.js"),
  ]);

  const commandPreview = preview.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "tt",
      cursorIndex: 2,
      selectedCompletionIndex: 0,
    },
    entries: [],
  });
  const argumentPreview = preview.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "strand n",
      cursorIndex: 8,
      selectedCompletionIndex: 0,
    },
    entries: [],
  });

  assert.equal(commandPreview.kind, "documentation");
  assert.equal(commandPreview.title, ":ttd");
  assert.match(commandPreview.lines[0], /Usage: :ttd/);
  assert.equal(argumentPreview.kind, "documentation");
  assert.equal(argumentPreview.title, ":strand");
  assert.match(argumentPreview.lines.join("\n"), /new from here/);
  const helpItem = completion.workspaceCommandLineCompletionItems({
    commandLine: {
      input: "help ",
      cursorIndex: 5,
      selectedCompletionIndex: 0,
    },
    entries: [],
  })[0];

  assert.equal(helpItem.label, "edit");
  assert.equal(helpItem.previewCommandName, "edit");
});

test("workspace command help reports unknown commands consistently", async () => {
  const catalog = await importDist("app", "workspace", "workspace-command-catalog.js");

  assert.equal(catalog.workspaceCommandHelpTitle("nope"), "Command help");
  assert.deepEqual(catalog.workspaceCommandHelpLines("nope"), ["Unknown command: nope"]);
});

test("workspace command help normalizes command names and aliases", async () => {
  const catalog = await importDist("app", "workspace", "workspace-command-catalog.js");

  assert.equal(catalog.workspaceCommandHelpTitle("Write"), ":write");
  assert.match(catalog.workspaceCommandHelpLines("W").join("\n"), /Usage: :write/);
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
  const entries = editEntries(fileSystem);

  const preview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
    entries,
    maxPreviewLines: 2,
    filePreview: {
      identity: entries[2],
      filePath: "/repo/README.md",
      result: {
        kind: previewModule.WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded,
        lines: ["alpha", "beta", "gamma"],
        evidencePosture: "fixture",
      },
    },
  });

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
  const entries = editEntries(fileSystem);

  const unreadablePreview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
    entries,
    filePreview: {
      identity: entries[2],
      filePath: "/repo/README.md",
      result: {
        kind: previewModule.WORKSPACE_FILE_PREVIEW_RESULT_KIND.Unavailable,
        reason: "Unreadable file",
        evidencePosture: "fixture-unavailable",
      },
    },
  });
  const directoryPreview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      input: "e ",
      cursorIndex: 2,
      selectedCompletionIndex: 1,
    },
    entries,
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
  const entries = editEntries(fileSystem);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    entries,
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
  assert.equal(fileCommands.length, 1);
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
  assert.equal(commands.length, 1);
});

test("command-line mode enters edit completion directories with enter", async () => {
  const [keyBindings, titleScreen, editorMode, fileSystem] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("ports", "file-system.js"),
  ]);
  const entriesByPath = new Map([
    [
      "/repo",
      [
        parentEntry(fileSystem, "/"),
        directoryEntry(fileSystem, "src", "/repo/src"),
        fileEntry(fileSystem, "README.md", "/repo/README.md"),
      ],
    ],
    [
      "/repo/src",
      [
        parentEntry(fileSystem, "/repo"),
        directoryEntry(fileSystem, "deep", "/repo/src/deep"),
        fileEntry(fileSystem, "index.ts", "/repo/src/index.ts"),
      ],
    ],
    [
      "/repo/src/deep",
      [
        parentEntry(fileSystem, "/repo/src"),
        fileEntry(fileSystem, "leaf.ts", "/repo/src/deep/leaf.ts"),
      ],
    ],
  ]);
  const context = mockKeyBindingContext({
    deps: {
      fileSystem: {
        loadEntries: (cwd) => entriesByPath.get(cwd) ?? [],
        describeDirectoryIssue: () => ({
          title: "directory issue",
          message: "directory issue",
        }),
        dirname: (cwd) => cwd.split("/").slice(0, -1).join("/") || "/",
        join: (...parts) => parts.join("/"),
        resolve: (...parts) => parts.join("/"),
      },
    },
  });
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    cwd: "/repo",
    entries: entriesByPath.get("/repo"),
    commandLine: {
      active: true,
      input: "edit ",
      cursorIndex: 5,
      selectedCompletionIndex: 1,
    },
  });

  const [srcModel, srcCommands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    model,
    context,
  );
  const [srcDirectorySelected] = keyBindings.updateFromKey(
    { type: "key", key: "down", ctrl: false, alt: false, shift: false },
    srcModel,
    context,
  );
  const [deepModel, deepCommands] = keyBindings.updateFromKey(
    { type: "key", key: "enter", ctrl: false, alt: false, shift: false },
    srcDirectorySelected,
    context,
  );

  assert.equal(srcModel.cwd, "/repo/src");
  assert.equal(srcModel.commandLine.active, true);
  assert.equal(srcModel.commandLine.input, "edit ");
  assert.equal(srcModel.commandLine.cursorIndex, 5);
  assert.deepEqual(srcModel.entries.map((entry) => entry.name), [
    "..",
    "deep",
    "index.ts",
  ]);
  assert.deepEqual(srcCommands, []);
  assert.equal(srcDirectorySelected.commandLine.selectedCompletionIndex, 1);
  assert.equal(deepModel.cwd, "/repo/src/deep");
  assert.equal(deepModel.commandLine.active, true);
  assert.equal(deepModel.commandLine.input, "edit ");
  assert.deepEqual(deepModel.entries.map((entry) => entry.name), [
    "..",
    "leaf.ts",
  ]);
  assert.deepEqual(deepCommands, []);
});

test("workspace render paints command completions above the Vim command line", async () => {
  const [viewer, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 22,
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

  const text = surfaceText(viewer.renderWorkspace(model));

  assert.match(text, /› edit\s+cmd\s+Open a file/);
  assert.match(text, /^:e\s*$/m);
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

  const completionText = surfaceText(viewer.renderWorkspace(model));

  assert.match(completionText, /› edit\s+cmd\s+Open a file/);
  assert.match(completionText, /quit\s+cmd\s+Quit jedit/);
  assert.match(completionText, /ttd\s+cmd\s+Observe a causal tick/);
  assert.match(completionText, /strand\s+cmd\s+Create, switch, or lis/);
  assert.match(completionText, /braid\s+cmd\s+View, preview, or admit/);
  assert.match(completionText, /why\s+cmd\s+Explain the last meaningf/);
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
  const completionRow = surfaceText(surface)
    .split("\n")
    .find((line) => line.includes("› edit"));

  assert.ok(completionRow);
  assert.equal(completionRow.indexOf("›"), 1);
  assert.notEqual(completionRow.indexOf("›"), 4);
});

test("workspace render paints edit file completions above the Vim command line", async () => {
  const [viewer, previewModule, titleScreen, editorMode, fileSystem] =
    await Promise.all([
      importDist("app", "workspace", "viewer.js"),
      importDist("app", "workspace", "command-completion-preview.js"),
      importDist("ui", "title-screen.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("ports", "file-system.js"),
    ]);
  const entries = editEntries(fileSystem);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 18,
    editor: mockEditor(editorMode, { lines: ["hello world"] }),
    focusPane: "editor",
    footerVisible: true,
    entries,
    jeditTheme: workspaceRenderTheme(),
    commandLine: {
      active: true,
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
    commandLineFilePreview: {
      identity: entries[2],
      filePath: "/repo/README.md",
      result: {
        kind: previewModule.WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded,
        lines: ["# README", "Project notes"],
        evidencePosture: "fixture-file",
      },
    },
  });

  const lines = surfaceText(viewer.renderWorkspace(model)).split("\n");

  assert.match(lines[12], /› README\.md\s+file\s+File/);
  assert.match(lines[12], /FILE README\.md/);
  assert.match(lines[13], /Evidence: fixture-file/);
  assert.match(lines[14], /# README/);
  assert.match(lines[15], /Project notes/);
  assert.match(lines[16], /^:edit R\s*$/);
});

test("command-line file previews require matching entry identity", async () => {
  const [previewModule, fileSystem] =
    await Promise.all([
      importDist("app", "workspace", "command-completion-preview.js"),
      importDist("ports", "file-system.js"),
    ]);
  const entries = editEntries(fileSystem);
  const samePathEntries = entries.map((entry) => ({ ...entry }));

  const preview = previewModule.workspaceCommandLineCompletionPreview({
    commandLine: {
      active: true,
      input: "edit R",
      cursorIndex: 6,
      selectedCompletionIndex: 0,
    },
    entries: samePathEntries,
    filePreview: {
      identity: entries[2],
      filePath: "/repo/README.md",
      result: {
        kind: previewModule.WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded,
        lines: ["# README"],
        evidencePosture: "fixture-file",
      },
    },
  });

  assert.equal(preview.kind, "unavailable");
  assert.deepEqual(preview.lines, ["Preview unavailable"]);
});

test("command-line file preview loads outside the render path", async () => {
  const [keyBindings, viewer, previewModule, msgModule, titleScreen, fileSystem] =
    await Promise.all([
      importDist("app", "workspace", "key-bindings.js"),
      importDist("app", "workspace", "viewer.js"),
      importDist("app", "workspace", "command-completion-preview.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("ui", "title-screen.js"),
      importDist("ports", "file-system.js"),
    ]);
  const previewCalls = [];
  const context = mockKeyBindingContext({
    deps: {
      editorFile: {
        loadEditorFile(filePath) {
          previewCalls.push(filePath);
          return { lines: ["# README", "Project notes"], readOnly: false };
        },
        saveEditorFile: () => undefined,
      },
    },
  });
  const entries = editEntries(fileSystem);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 80,
    rows: 18,
    footerVisible: true,
    entries,
    jeditTheme: workspaceRenderTheme(),
    commandLine: {
      active: true,
      input: "edit ",
      cursorIndex: 5,
      selectedCompletionIndex: 0,
    },
  });

  const [pending, commands] = keyBindings.updateFromKey(
    { type: "key", key: "R", ctrl: false, alt: false, shift: false },
    model,
    context,
  );

  assert.equal(pending.commandLineFilePreviewRequest?.filePath, "/repo/README.md");
  assert.equal(pending.commandLineFilePreviewRequest?.identity, entries[2]);
  assert.equal(commands.length, 1);
  assert.deepEqual(previewCalls, []);
  viewer.renderWorkspace(pending);
  assert.deepEqual(previewCalls, []);

  const previewMessage = await commands[0]();
  assert.equal(
    previewMessage.type,
    msgModule.WorkspaceMessageTypes.CommandLineFilePreviewResult,
  );
  assert.deepEqual(previewCalls, ["/repo/README.md"]);

  const cleared = {
    ...pending,
    commandLineFilePreviewRequest: undefined,
  };
  const stale = previewModule.applyWorkspaceCommandLineFilePreviewResult(
    cleared,
    previewMessage,
  );
  assert.equal(stale.commandLineFilePreview, undefined);

  const loaded = previewModule.applyWorkspaceCommandLineFilePreviewResult(
    pending,
    previewMessage,
  );
  const lines = surfaceText(viewer.renderWorkspace(loaded)).split("\n");

  assert.match(lines[12], /FILE README\.md/);
  assert.match(lines[13], /Evidence: loaded/);
  assert.match(lines[14], /# README/);
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

function parentEntry(fileSystem, path) {
  return {
    kind: fileSystem.FileEntryKinds.Parent,
    name: "..",
    path,
  };
}

function directoryEntry(fileSystem, name, path) {
  return {
    kind: fileSystem.FileEntryKinds.Directory,
    name,
    path,
  };
}

function fileEntry(fileSystem, name, path) {
  return {
    kind: fileSystem.FileEntryKinds.File,
    name,
    path,
  };
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
      currentLine: workspace,
      drawer,
      header: footer,
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
    gutter: {
      normal: mockGutterTokens(workspace, edge),
      dimmed: mockGutterTokens(workspace, edge),
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
