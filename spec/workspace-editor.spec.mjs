import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockEditor,
} from './workspace-helpers.mjs';

test('read-only insert mode still exits through escape', async () => {
  const [editing, mode] = await Promise.all([
    importDist('app', 'workspace', 'editor-editing.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
  ]);
  const nextEditor = editing.updateInsertMode(
    mockEditor(mode, { readOnly: true, mode: mode.EditorModes.Insert, cursorCol: 5 }),
    { key: 'escape' },
    80,
    24,
    true,
  );

  assert.equal(nextEditor.mode, mode.EditorModes.Normal);
});

test('read-only normal mode does not run mutating commands', async () => {
  const [editing, mode] = await Promise.all([
    importDist('app', 'workspace', 'editor-editing.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
  ]);
  const editor = mockEditor(mode, {
    readOnly: true,
    lines: ['alpha', 'beta'],
    cursorRow: 0,
    cursorCol: 1,
  });
  const nextEditor = editing.updateNormalMode(editor, { key: 'o' }, 80, 24);

  assert.deepEqual(nextEditor.lines, editor.lines);
  assert.equal(nextEditor.mode, mode.EditorModes.Normal);
  assert.equal(nextEditor.undoStack.length, 0);
});

test('normal mode change-to-line-end deletes text before entering insert mode', async () => {
  const [editing, mode, model] = await Promise.all([
    importDist('app', 'workspace', 'editor-editing.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'editor', 'model.js'),
  ]);
  const nextEditor = editing.updateNormalMode(
    mockEditor(mode, { cursorCol: 6 }),
    { key: 'c', shift: true, ctrl: false, alt: false },
    80,
    24,
  );

  assert.deepEqual(nextEditor.lines, ['hello ']);
  assert.equal(nextEditor.mode, mode.EditorModes.Insert);
  assert.equal(nextEditor.register.kind, model.RegisterKinds.Char);
  assert.equal(nextEditor.register.text, 'world');
});

test('preview scrolling clamps to the loaded line range', async () => {
  const [editing, mode] = await Promise.all([
    importDist('app', 'workspace', 'editor-editing.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
  ]);
  const editor = mockEditor(mode, {
    lines: ['first', 'second'],
    scrollRow: 0,
  });
  const nextEditor = editing.scrollPreview(editor, { key: 'pagedown' }, 24);

  assert.equal(nextEditor.scrollRow, 1);
});

test('markdown file detection normalizes uppercase extensions', async () => {
  const fileTypes = await importDist('app', 'workspace', 'file-types.js');

  assert.equal(fileTypes.isMarkdownFile('/repo/README.MD'), true);
  assert.equal(fileTypes.isMarkdownFile('/repo/guide.Markdown'), true);
});

test('workspace view mode exposes runtime tokens', async () => {
  const viewMode = await importDist('app', 'workspace', 'view-mode.js');

  assert.equal(viewMode.ViewModes.Source, 'source');
  assert.equal(viewMode.ViewModes.Preview, 'preview');
});

test('editor mode exposes runtime mode, key, register, and operator tokens', async () => {
  const [mode, model, editorKeys] = await Promise.all([
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'editor', 'model.js'),
    importDist('app', 'workspace', 'editor', 'key.js'),
  ]);

  assert.equal(mode.EditorModes.Normal, 'normal');
  assert.equal(mode.EditorModes.Insert, 'insert');
  assert.equal(mode.PendingNormals.Change, 'c');
  assert.equal(mode.PendingNormals.Delete, 'd');
  assert.equal(mode.PendingNormals.GoTo, 'g');
  assert.equal(mode.PendingNormals.Yank, 'y');
  assert.equal(mode.PendingOperators.Change, 'change');
  assert.equal(mode.PendingOperators.Delete, 'delete');
  assert.equal(mode.PendingOperators.Yank, 'yank');
  assert.equal(model.RegisterKinds.Char, 'char');
  assert.equal(model.RegisterKinds.Line, 'line');
  assert.equal(editorKeys.EditorKeys.PageDown, 'pagedown');
});
