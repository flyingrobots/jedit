import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

test("editor viewport reserves the rendered line-number gutter", async () => {
  const viewport = await importDist("app", "workspace", "viewport.js");
  const sourceViewer = await importDist("ui", "source-viewer.js");

  const model = {
    columns: 100,
    rows: 24,
    fileDrawerProgress: 0,
    graftDrawerProgress: 0,
    footerVisible: true,
    lineNumberMode: "absolute",
    editor: {
      lines: Array.from({ length: 120 }, () => "x".repeat(100)),
      cursorRow: 70,
    },
  };

  const viewerViewport = viewport.editorViewport({
    ...model,
    editor: undefined,
    lineNumberMode: undefined,
  });
  const textViewport = viewport.editorViewport(model);
  const gutterWidth = sourceViewer.sourceViewerGutterWidth(
    model.editor.lines.length,
    model.editor.cursorRow,
    model.lineNumberMode,
  );

  assert.equal(viewerViewport.width - textViewport.width, gutterWidth);
});
