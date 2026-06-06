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

test("workspace command completion provider leaves argument text to later providers", async () => {
  const completion = await importDist("app", "workspace", "command-completion.js");

  const items = completion.workspaceCommandCompletionItems({
    input: "edit README.md",
    cursorIndex: 7,
  });

  assert.deepEqual(items, []);
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
  assert.equal(accepted.commandLine.input, "edit");
  assert.equal(accepted.commandLine.cursorIndex, 4);
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

  assert.match(lines[15], /› edit\s+C\s+Open a file/);
  assert.match(lines[16], /^:e\s*$/);
});

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
