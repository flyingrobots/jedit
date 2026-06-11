import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
} from "./workspace-helpers.mjs";


test("normal mode stores pending vim keys and dot repeats the last edit", async () => {
  const [mode, editing] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "editor-editing.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha beta gamma"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const pending = editing.updateNormalMode(editor, { key: "d" }, 80, 24);
  const deleted = editing.updateNormalMode(pending, { key: "w" }, 80, 24);
  const repeated = editing.updateNormalMode(deleted, { key: "." }, 80, 24);

  assert.deepEqual(pending.pendingVimKeys, ["d"]);
  assert.deepEqual(deleted.lines, ["beta gamma"]);
  assert.deepEqual(deleted.lastVimEdit.keys, ["d", "w"]);
  assert.deepEqual(repeated.lines, ["gamma"]);
});

test("dot repeat resolves text objects against the current basis", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ['"alpha"', '"beta"'],
    cursorRow: 0,
    cursorCol: 2,
  });

  const firstDelete = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "i", '"']),
  );
  const repeated = executor.repeatLastVimEdit({
    ...firstDelete,
    cursorRow: 1,
    cursorCol: 2,
  });

  assert.deepEqual(firstDelete.lines, ['""', '"beta"']);
  assert.deepEqual(repeated.lines, ['""', '""']);
  assert.equal(firstDelete.lastVimEdit.replayPolicy, "resolve-current-basis");
  assert.match(firstDelete.lastVimEdit.sourceBasisDigest, /^vim-basis:/);
});

test("normal mode preserves legacy pending operators without vim key state", async () => {
  const [mode, editing] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "editor-editing.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha beta"],
    cursorRow: 0,
    cursorCol: 0,
    pendingNormal: mode.PendingNormals.Delete,
  });

  const nextEditor = editing.updateNormalMode(editor, { key: "w" }, 80, 24);

  assert.deepEqual(nextEditor.lines, ["beta"]);
  assert.equal(nextEditor.pendingNormal, undefined);
});
