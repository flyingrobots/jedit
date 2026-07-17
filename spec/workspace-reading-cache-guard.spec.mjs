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

  const [readingCacheSource, authoritySource, runtimeSource] = source;
  assert.match(
    readingCacheSource,
    /function editorFromFullWorkspaceTextReadingCache\([\s\S]*readonly cache: WorkspaceTextFullReadingCache/s,
  );
  assert.match(
    readingCacheSource,
    /function materializeWorkspaceTextReadingCache\(\s*cache: WorkspaceTextFullReadingCache/s,
  );
  assert.match(
    authoritySource,
    /function editorFromFullWorkspaceTextCache\([\s\S]*readonly cache: WorkspaceTextFullReadingCache/s,
  );
  assert.match(
    readingCacheSource,
    /if \(canReadingReplaceWholeEditor\(authority\.cache\)\) \{[\s\S]*editorFromFullWorkspaceTextReadingCache/s,
  );
  assert.match(
    runtimeSource,
    /function editorAfterTextEdit\([\s\S]*workspaceModelWithTextAuthorityEditor\(/s,
  );
  assert.match(
    runtimeSource,
    /function withTextAuthority\([\s\S]*workspaceModelWithTextAuthorityEditor\(/s,
  );
});

test("viewer key follow-up reads use current editor aperture", async () => {
  const source = await readWorkspaceFile("src/app/workspace/viewer-key.ts");

  assert.doesNotMatch(source, /\bdefaultWorkspaceTextAperture\(/);
  assert.match(source, /\bworkspaceTextApertureFromEditor\(/);
});

test("save export path delegates to production authority rather than reading caches", async () => {
  const [commandsSource, saveKeySource, productionSource] = await Promise.all([
    readWorkspaceFile("src/app/workspace/workspace-text-commands.ts"),
    readWorkspaceFile("src/app/workspace/workspace-save-key.ts"),
    readWorkspaceFile("src/app/workspace/production-text-session.ts"),
  ]);

  assert.doesNotMatch(commandsSource, /\bexportWindow\b/);
  assert.doesNotMatch(commandsSource, /\bsaveEditorFile\([^;]*cache\.lines/s);
  assert.doesNotMatch(saveKeySource, /\bfullWorkspaceTextExportAperture\b/);
  assert.doesNotMatch(saveKeySource, /\baperture:/);

  const exportBody = functionBody(commandsSource, "exportWorkspaceText");
  assert.doesNotMatch(exportBody, /\bcache\.lines\b/);
  assert.doesNotMatch(exportBody, /\bauthority\.cache\b/);
  assert.doesNotMatch(exportBody, /\bWorkspaceTextReadingCache\b/);
  assert.doesNotMatch(exportBody, /\bmaterializeWorkspaceTextReadingCache\b/);
  assert.match(exportBody, /\bproductionTextSession\.exportSnapshot\(/);
  assert.match(exportBody, /\bsaveEditorFile\(request\.filePath,\s*savedLines\)/);
  assert.match(commandsSource, /\bproductionTextSession\.exportSnapshot\(/);
  assert.match(productionSource, /\bexportSnapshot\b/);
  assert.doesNotMatch(productionSource, /\bcreateProductionTextSession\b/);
});

test("edit and read follow-up observations do not fall back to top-of-file apertures", async () => {
  const commandsSource = await readWorkspaceFile("src/app/workspace/workspace-text-commands.ts");
  const editBody = functionBody(commandsSource, "editWorkspaceText");
  const readBody = functionBody(commandsSource, "readWorkspaceText");

  assert.doesNotMatch(editBody, /\bdefaultWorkspaceTextAperture\(/);
  assert.doesNotMatch(readBody, /\bdefaultWorkspaceTextAperture\(/);
  assert.match(editBody, /\baperture:\s*request\.aperture\b/);
  assert.match(readBody, /\baperture:\s*request\.aperture\b/);
});

async function readWorkspaceFile(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

function functionBody(source, name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1, `missing function body for ${name}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }
  assert.fail(`unterminated function body for ${name}`);
}
