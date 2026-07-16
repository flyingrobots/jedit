import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./workspace-helpers.mjs";

test("inline evidence panel prefers below and falls back above its anchor", async () => {
  const overlay = await importDist("app", "workspace", "workspace-inline-panel-overlay.js");

  assert.equal(overlay.resolveWorkspaceInlinePanelY(4, 1, 20, 5), 5);
  assert.equal(overlay.resolveWorkspaceInlinePanelY(17, 1, 20, 5), 12);
});

test("inline evidence panel persists until cursor, basis, or Escape invalidates it", async () => {
  const panel = await importDist("app", "workspace", "workspace-inline-panel.js");
  const model = panelModel();
  const ordinaryKey = { type: "key", key: "z", ctrl: false, alt: false, shift: false };

  assert.equal(panel.clearWorkspaceInlinePanelAfterKey(ordinaryKey, model), model);
  assert.equal(panel.clearWorkspaceInlinePanelAfterKey(
    ordinaryKey,
    { ...model, editor: { ...model.editor, cursorCol: 3 } },
  ).inlinePanel, undefined);
  assert.equal(panel.clearWorkspaceInlinePanelAfterKey(
    ordinaryKey,
    {
      ...model,
      textAuthority: {
        ...model.textAuthority,
        durability: { ...model.textAuthority.durability, causal: { kind: "admitted", headId: "head:2" } },
      },
    },
  ).inlinePanel, undefined);
  assert.equal(panel.clearWorkspaceInlinePanelAfterKey(
    { ...ordinaryKey, key: "escape" },
    model,
  ).inlinePanel, undefined);
});

function panelModel() {
  return {
    inlinePanel: {
      title: "Why range",
      message: "evidence",
      tone: "info",
      anchorRow: 1,
      anchorColumn: 2,
      basisHeadId: "head:1",
      bufferId: "buffer:1",
    },
    editor: { cursorRow: 1, cursorCol: 2 },
    focusPane: "editor",
    viewMode: "source",
    commandLine: { active: false },
    textAuthority: {
      kind: "opened",
      bufferId: "buffer:1",
      durability: { causal: { kind: "admitted", headId: "head:1" } },
    },
  };
}
