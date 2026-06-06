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
  assert.match(rowText(surface, 0), /^  edit\s+C\s+Open a file/);
  assert.match(rowText(surface, 1), /^› write\s+C\s+Write/);
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
