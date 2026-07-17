import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./workspace-helpers.mjs";
import { producedRangeWhyReport } from "./support/range-why-report-fixture.mjs";

const PANEL_RANGE = Object.freeze({ startByte: 1, endByte: 2 });

test("inline evidence panel prefers below and falls back above its anchor", async () => {
  const overlay = await importDist("app", "workspace", "workspace-inline-panel-overlay.js");

  assert.equal(overlay.resolveWorkspaceInlinePanelY(4, 1, 20, 5), 5);
  assert.equal(overlay.resolveWorkspaceInlinePanelY(17, 1, 20, 5), 12);
});

test("inline evidence panel persists until cursor, basis, or Escape invalidates it", async () => {
  const panel = await importDist("app", "workspace", "workspace-inline-panel.js");
  const model = panelModel(panel);
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

test("why-range panel state derives its basis and rejects forged mismatches", async () => {
  const panel = await importDist("app", "workspace", "workspace-inline-panel.js");
  const model = panelModel(panel);
  const forged = {
    ...model,
    inlinePanel: { ...model.inlinePanel, basisHeadId: "head:forged" },
  };

  assert.equal(model.inlinePanel.basisHeadId, model.inlinePanel.whyRangeReport.witness.basisHeadId);
  assert.equal(panel.workspaceInlinePanelWhyRangeReport(forged), undefined);
});

function panelModel(panel) {
  const report = producedRangeWhyReport(PANEL_RANGE, {
    basisHeadId: "head:1",
    message: "evidence",
  });
  const content = panel.workspaceWhyRangeInlinePanelContent({
    title: report.title,
    message: report.message,
    tone: "info",
    bufferId: "buffer:1",
    report,
  });
  return {
    inlinePanel: panel.workspaceInlinePanelAtAnchor(content, { row: 1, column: 2 }),
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
