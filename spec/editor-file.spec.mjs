import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'editor-file.js');
const LEGACY_TRUNCATION_BYTES = 24_000;
const LARGE_LINE_COUNT = 900;
const LARGE_LINE_FILL = 80;
const TRUNCATION_MARKER = '[truncated]';
const BINARY_FILE_MESSAGE = '[binary file]';

async function loadEditorFileModule() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

function createTempDir(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jedit-editor-file-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  return tempDir;
}

test('loads text files larger than the legacy truncation cap as editable full buffers', async (t) => {
  const editorFile = await loadEditorFileModule();
  const tempDir = createTempDir(t);
  const filePath = path.join(tempDir, 'large-main.ts');
  const lines = Array.from(
    { length: LARGE_LINE_COUNT },
    (_, index) => `line ${index}: ${'x'.repeat(LARGE_LINE_FILL)}`,
  );
  const text = lines.join('\n');
  assert.ok(Buffer.byteLength(text, 'utf8') > LEGACY_TRUNCATION_BYTES);

  fs.writeFileSync(filePath, text, 'utf8');

  const loaded = editorFile.loadEditorFile(filePath);

  assert.equal(loaded.readOnly, false);
  assert.deepEqual(loaded.lines, lines);
  assert.equal(loaded.lines.includes(TRUNCATION_MARKER), false);
});

test('keeps binary files read-only', async (t) => {
  const editorFile = await loadEditorFileModule();
  const tempDir = createTempDir(t);
  const filePath = path.join(tempDir, 'binary.bin');

  fs.writeFileSync(filePath, Buffer.from([65, 0, 66]));

  const loaded = editorFile.loadEditorFile(filePath);

  assert.equal(loaded.readOnly, true);
  assert.deepEqual(loaded.lines, [BINARY_FILE_MESSAGE]);
});

test('saves editor lines with line-feed separators', async (t) => {
  const editorFile = await loadEditorFileModule();
  const tempDir = createTempDir(t);
  const filePath = path.join(tempDir, 'save.ts');

  editorFile.saveEditorFile(filePath, ['alpha', 'beta']);

  assert.equal(fs.readFileSync(filePath, 'utf8'), 'alpha\nbeta');
});
