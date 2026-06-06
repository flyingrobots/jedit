import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
  mockTitleScreenModel,
} from "./workspace-helpers.mjs";

test("workspace editor completion context uses the active editor cursor word", async () => {
  const [completion, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "editor-completion.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      path: "/repo/src/app.ts",
      lines: ["const alpha_beta = value"],
      cursorRow: 0,
      cursorCol: 16,
    }),
  });

  const context = completion.workspaceEditorCompletionContext(model);

  assert.deepEqual(context, {
    filePath: "/repo/src/app.ts",
    lineText: "const alpha_beta = value",
    cursorRow: 0,
    cursorCol: 16,
    wordStartCol: 6,
    wordEndCol: 16,
    prefix: "alpha_beta",
  });
});

test("workspace editor completion registry returns provider-neutral inline items", async () => {
  const [completion, popup, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "editor-completion.js"),
    importDist("ui", "inline-completion-popup.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const seenPrefixes = [];
  const model = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode, {
      lines: ["call al"],
      cursorRow: 0,
      cursorCol: 7,
    }),
  });
  const registry = {
    providers: [
      {
        id: "fake-symbols",
        complete(context) {
          seenPrefixes.push(context.prefix);
          return [
            {
              id: "symbol:alpha",
              label: "alpha",
              detail: "function",
              kind: popup.INLINE_COMPLETION_ITEM_KIND.Symbol,
              providerId: "fake-symbols",
              replacement: {
                start: context.wordStartCol,
                end: context.wordEndCol,
                text: "alpha",
              },
            },
          ];
        },
      },
    ],
  };

  const items = completion.workspaceEditorCompletionItems({ model, registry });

  assert.deepEqual(seenPrefixes, ["al"]);
  assert.deepEqual(items, [
    {
      id: "symbol:alpha",
      label: "alpha",
      detail: "function",
      kind: popup.INLINE_COMPLETION_ITEM_KIND.Symbol,
      providerId: "fake-symbols",
      replacement: {
        start: 5,
        end: 7,
        text: "alpha",
      },
    },
  ]);
});

test("workspace editor completion is empty when no editor owns context", async () => {
  const [completion, titleScreen] = await Promise.all([
    importDist("app", "workspace", "editor-completion.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    editor: undefined,
  });

  assert.equal(completion.workspaceEditorCompletionContext(model), undefined);
  assert.deepEqual(
    completion.workspaceEditorCompletionItems({
      model,
      registry: completion.EMPTY_WORKSPACE_EDITOR_COMPLETION_REGISTRY,
    }),
    [],
  );
});
