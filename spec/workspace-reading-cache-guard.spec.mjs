import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { REPO_ROOT } from "./workspace-helpers.mjs";

test("workspace text cache has no unsafe whole-editor rebuild helper", async () => {
  const workspaceFiles = [
    "src/app/workspace/workspace-text-reading-cache.ts",
    "src/app/workspace/workspace-text-authority.ts",
    "src/app/workspace/workspace-text-runtime-state.ts",
    "src/app/workspace/viewer-content.ts",
  ];
  const source = await Promise.all(workspaceFiles.map(readWorkspaceFile));

  for (const fileSource of source) {
    assert.doesNotMatch(fileSource, /\beditorFromWorkspaceTextReadingCache\b/);
    assert.doesNotMatch(fileSource, /\beditorFromWorkspaceTextCache\b/);
  }
  assert.match(source.join("\n"), /\bcanReadingReplaceWholeEditor\b/);
  assert.match(source.join("\n"), /\beditorFromFullWorkspaceTextReadingCache\b/);
});

test("viewer key follow-up reads use current editor aperture", async () => {
  const source = await readWorkspaceFile("src/app/workspace/viewer-key.ts");

  assert.doesNotMatch(source, /\bdefaultWorkspaceTextAperture\(/);
  assert.match(source, /\bworkspaceTextApertureFromEditor\(/);
});

test("save export path uses full snapshots rather than reading-cache or window exports", async () => {
  const [commandsSource, saveKeySource, productionSource, witnessSource] = await Promise.all([
    readWorkspaceFile("src/app/workspace/workspace-text-commands.ts"),
    readWorkspaceFile("src/app/workspace/workspace-save-key.ts"),
    readWorkspaceFile("src/app/workspace/production-text-session.ts"),
    readWorkspaceFile("scripts/jedit-workspace-echo-witness.mjs"),
  ]);

  assert.doesNotMatch(commandsSource, /\bexportWindow\b/);
  assert.doesNotMatch(witnessSource, /\bexportWindow\b/);
  assert.doesNotMatch(commandsSource, /\bsaveEditorFile\([^;]*cache\.lines/s);
  assert.doesNotMatch(saveKeySource, /\bfullWorkspaceTextExportAperture\b/);
  assert.doesNotMatch(saveKeySource, /\baperture:/);
  assert.match(commandsSource, /\bproductionTextSession\.exportSnapshot\(/);
  assert.match(productionSource, /\bexportSnapshot\b/);
  assert.match(productionSource, /\bobservedReadingCoversFullSnapshot\b/);
});

async function readWorkspaceFile(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}
