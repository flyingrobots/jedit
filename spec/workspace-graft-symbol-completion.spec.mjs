import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
  mockTitleScreenModel,
} from "./workspace-helpers.mjs";

test("graft symbol completion provider maps outline hits to editor completions", async () => {
  const [completion, graftCompletion, popup, titleScreen, editorMode] =
    await Promise.all([
      importDist("app", "workspace", "editor-completion.js"),
      importDist("app", "workspace", "graft-symbol-completion.js"),
      importDist("ui", "inline-completion-popup.js"),
      importDist("ui", "title-screen.js"),
      importDist("app", "workspace", "editor", "mode.js"),
    ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      path: "/repo/src/render.ts",
      lines: ["ren"],
      cursorRow: 0,
      cursorCol: 3,
    }),
  });
  const registry = {
    providers: [
      graftCompletion.workspaceGraftSymbolCompletionProvider({
        graftInfo: fakeGraftInfo(),
      }),
    ],
  };

  const items = completion.workspaceEditorCompletionItems({ model, registry });

  assert.deepEqual(items, [
    {
      id: "graft-symbol:src/render.ts:renderScene:4:12",
      label: "renderScene",
      detail: "function src/render.ts:4",
      kind: popup.INLINE_COMPLETION_ITEM_KIND.Symbol,
      providerId: graftCompletion.WORKSPACE_GRAFT_SYMBOL_PROVIDER_ID,
      previewRequestId: "preview:graft-symbol:src/render.ts:renderScene:4:12",
      replacement: {
        start: 0,
        end: 3,
        text: "renderScene",
      },
    },
  ]);
});

test("graft symbol completion provider renders through the shared popup", async () => {
  const [completion, graftCompletion, popup, titleScreen, editorMode] =
    await Promise.all([
      importDist("app", "workspace", "editor-completion.js"),
      importDist("app", "workspace", "graft-symbol-completion.js"),
      importDist("ui", "inline-completion-popup.js"),
      importDist("ui", "title-screen.js"),
      importDist("app", "workspace", "editor", "mode.js"),
    ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      path: "/repo/src/render.ts",
      lines: ["ren"],
      cursorRow: 0,
      cursorCol: 3,
    }),
  });
  const items = completion.workspaceEditorCompletionItems({
    model,
    registry: {
      providers: [
        graftCompletion.workspaceGraftSymbolCompletionProvider({
          graftInfo: fakeGraftInfo(),
        }),
      ],
    },
  });

  const surface = popup.renderInlineCompletionPopup({
    items,
    selectedIndex: 0,
    theme: popupTheme(),
    width: 56,
    maxHeight: 4,
  });

  assert.match(rowText(surface, 0), /^› renderScene\s+sym\s+function src\/render\.ts:4/);
});

test("graft symbol completion provider ignores stale Graft info", async () => {
  const [completion, graftCompletion, titleScreen, editorMode] =
    await Promise.all([
      importDist("app", "workspace", "editor-completion.js"),
      importDist("app", "workspace", "graft-symbol-completion.js"),
      importDist("ui", "title-screen.js"),
      importDist("app", "workspace", "editor", "mode.js"),
    ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      path: "/repo/src/other.ts",
      lines: ["ren"],
      cursorRow: 0,
      cursorCol: 3,
    }),
  });

  const items = completion.workspaceEditorCompletionItems({
    model,
    registry: {
      providers: [
        graftCompletion.workspaceGraftSymbolCompletionProvider({
          graftInfo: fakeGraftInfo(),
        }),
      ],
    },
  });

  assert.deepEqual(items, []);
});

function fakeGraftInfo() {
  return {
    path: "/repo/src/render.ts",
    relativePath: "src/render.ts",
    dirty: false,
    outlineItems: [
      {
        kind: "function",
        name: "renderScene",
        startLine: 4,
        endLine: 12,
      },
      {
        kind: "const",
        name: "loadScene",
        startLine: 18,
        endLine: 20,
      },
    ],
    changeLines: [],
  };
}

function popupTheme() {
  return {
    surface: {
      drawer: {
        fg: "#c9d1d9",
        bg: "#161b22",
      },
    },
    cursor: {
      normal: {
        fg: "#0d1117",
        bg: "#58a6ff",
      },
    },
  };
}

function rowText(surface, y) {
  let text = "";
  for (let x = 0; x < surface.width; x += 1) {
    text += surface.get(x, y).char;
  }
  return text;
}
