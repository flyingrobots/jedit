import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./workspace-helpers.mjs";

test("inline completion popup renders selected provider-neutral items with theme tokens", async () => {
  const popup = await importDist("ui", "inline-completion-popup.js");
  const theme = popupTheme();

  const surface = popup.renderInlineCompletionPopup({
    items: [
      {
        id: "command:edit",
        label: "edit",
        detail: "Open a file",
        kind: popup.INLINE_COMPLETION_ITEM_KIND.Command,
        providerId: "vim-command",
        replacement: { start: 0, end: 1, text: "edit" },
      },
      {
        id: "command:write",
        label: "write",
        detail: "Write the current file",
        kind: popup.INLINE_COMPLETION_ITEM_KIND.Command,
        providerId: "vim-command",
        replacement: { start: 0, end: 1, text: "write" },
      },
    ],
    selectedIndex: 1,
    theme,
    width: 24,
    maxHeight: 4,
  });

  assert.equal(surface.width, 24);
  assert.equal(surface.height, 2);
  assert.match(rowText(surface, 0), /^  edit\s+cmd\s+Open a file/);
  assert.match(rowText(surface, 1), /^› write\s+cmd\s+Write/);
  assert.equal(surface.get(0, 1).bg, theme.cursor.normal.bg);
  assert.equal(surface.get(0, 0).bg, theme.surface.drawer.bg);
  assert.equal(popup.INLINE_COMPLETION_PREVIEW_KIND.File, "file");
});

test("inline completion popup clips height and keeps the selected item visible", async () => {
  const popup = await importDist("ui", "inline-completion-popup.js");
  const surface = popup.renderInlineCompletionPopup({
    items: [
      item(popup, "edit"),
      item(popup, "write"),
      item(popup, "quit"),
      item(popup, "wq"),
    ],
    selectedIndex: 3,
    theme: popupTheme(),
    width: 12,
    maxHeight: 2,
  });

  assert.equal(surface.height, 2);
  assert.match(rowText(surface, 0), /^  quit/);
  assert.match(rowText(surface, 1), /^› wq/);
});

test("inline completion popup resolves below and above cursor geometry", async () => {
  const popup = await importDist("ui", "inline-completion-popup.js");
  const items = [
    item(popup, "edit"),
    item(popup, "write"),
    item(popup, "quit"),
    item(popup, "wq"),
  ];

  const below = popup.resolveInlineCompletionPopupGeometry({
    items,
    width: 32,
    maxHeight: 4,
    anchor: { x: 5, y: 4, screenWidth: 80, screenHeight: 24 },
  });
  const above = popup.resolveInlineCompletionPopupGeometry({
    items,
    width: 32,
    maxHeight: 4,
    anchor: { x: 5, y: 23, screenWidth: 80, screenHeight: 24 },
  });

  assert.equal(below.placement, popup.INLINE_COMPLETION_POPUP_PLACEMENT.Below);
  assert.equal(below.x, 5);
  assert.equal(below.y, 5);
  assert.equal(below.height, 4);
  assert.equal(above.placement, popup.INLINE_COMPLETION_POPUP_PLACEMENT.Above);
  assert.equal(above.x, 5);
  assert.equal(above.y, 19);
  assert.equal(above.height, 4);
});

test("inline completion popup renders adjacent preview on wide terminals", async () => {
  const popup = await importDist("ui", "inline-completion-popup.js");
  const theme = popupTheme();

  const surface = popup.renderInlineCompletionPopup({
    items: [item(popup, "edit"), item(popup, "write")],
    selectedIndex: 0,
    theme,
    width: 64,
    maxHeight: 5,
    preview: preview(popup),
  });
  const geometry = popup.resolveInlineCompletionPopupGeometry({
    items: [item(popup, "edit"), item(popup, "write")],
    width: 64,
    maxHeight: 5,
    preview: preview(popup),
  });

  assert.equal(surface.width, 64);
  assert.equal(surface.height, 5);
  assert.equal(geometry.previewVisible, true);
  assert.equal(geometry.previewWidth, 26);
  assert.equal(surface.get(37, 0).char, "│");
  assert.match(rowText(surface, 0), /FILE README\.md/);
  assert.match(rowText(surface, 1), /Evidence: runtime-backed/);
  assert.match(rowText(surface, 2), /export function main/);
});

test("inline completion popup omits preview on narrow terminals", async () => {
  const popup = await importDist("ui", "inline-completion-popup.js");

  const surface = popup.renderInlineCompletionPopup({
    items: [item(popup, "edit")],
    selectedIndex: 0,
    theme: popupTheme(),
    width: 42,
    maxHeight: 5,
    preview: preview(popup),
  });
  const geometry = popup.resolveInlineCompletionPopupGeometry({
    items: [item(popup, "edit")],
    width: 42,
    maxHeight: 5,
    preview: preview(popup),
  });

  assert.equal(surface.width, 42);
  assert.equal(surface.height, 1);
  assert.equal(geometry.previewVisible, false);
  assert.doesNotMatch(rowText(surface, 0), /README\.md/);
  assert.doesNotMatch(rowText(surface, 0), /export function/);
});

test("inline completion popup renders editor preview kinds", async () => {
  const popup = await importDist("ui", "inline-completion-popup.js");

  for (const previewCase of editorPreviewCases(popup)) {
    const surface = popup.renderInlineCompletionPopup({
      items: [symbolItem(popup)],
      selectedIndex: 0,
      theme: popupTheme(),
      width: 72,
      maxHeight: 4,
      preview: previewCase.preview,
    });

    assert.match(
      rowText(surface, 0),
      previewCase.headingPattern,
    );
    assert.match(rowText(surface, 1), /Evidence: graft-fixture/);
    assert.match(rowText(surface, 2), previewCase.bodyPattern);
  }
});

function item(popup, label) {
  return {
    id: `command:${label}`,
    label,
    detail: `${label} command`,
    kind: popup.INLINE_COMPLETION_ITEM_KIND.Command,
    providerId: "vim-command",
    replacement: { start: 0, end: label.length, text: label },
  };
}

function symbolItem(popup) {
  return {
    id: "graft-symbol:src/render.ts:renderScene:4:12",
    label: "renderScene",
    detail: "function src/render.ts:4",
    kind: popup.INLINE_COMPLETION_ITEM_KIND.Symbol,
    providerId: "graft-symbol",
    replacement: { start: 0, end: 3, text: "renderScene" },
  };
}

function preview(popup) {
  return {
    id: "preview:readme",
    kind: popup.INLINE_COMPLETION_PREVIEW_KIND.File,
    title: "README.md",
    lines: [
      "export function main()",
      "  opens a production file",
      "end",
    ],
    providerId: "vim-command",
    evidencePosture: "runtime-backed",
  };
}

function editorPreviewCases(popup) {
  return [
    {
      preview: editorPreview(
        popup,
        popup.INLINE_COMPLETION_PREVIEW_KIND.Documentation,
        "renderScene docs",
        ["Draws the active title scene."],
      ),
      headingPattern: /DOCS renderScene docs/,
      bodyPattern: /Draws the active title scene/,
    },
    {
      preview: editorPreview(
        popup,
        popup.INLINE_COMPLETION_PREVIEW_KIND.SourceDefinition,
        "renderScene definition",
        ["export function renderScene"],
      ),
      headingPattern: /SRC renderScene definition/,
      bodyPattern: /export function renderScene/,
    },
    {
      preview: editorPreview(
        popup,
        popup.INLINE_COMPLETION_PREVIEW_KIND.CausalHistory,
        "renderScene history",
        ["changed by title renderer goalpost"],
      ),
      headingPattern: /HIST renderScene history/,
      bodyPattern: /changed by title renderer goal/,
    },
  ];
}

function editorPreview(popup, kind, title, lines) {
  return {
    id: `preview:${kind}:renderScene`,
    kind,
    title,
    lines,
    providerId: "graft-symbol",
    evidencePosture: "graft-fixture",
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
