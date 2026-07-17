import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
} from "./workspace-helpers.mjs";


test("vim case operators transform motion and text object ranges", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha beta", "gamma"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const upper = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["g", "U", "i", "w"]),
  );
  const lower = executor.applyVimChordSyntaxToEditor(
    { ...upper, cursorRow: 0, cursorCol: 6 },
    syntax.parseVimChordSyntax(["g", "u", "w"]),
  );
  const swapped = executor.applyVimChordSyntaxToEditor(
    { ...lower, cursorRow: 1, cursorCol: 0 },
    syntax.parseVimChordSyntax(["g", "~", "G"]),
  );

  assert.deepEqual(upper.lines, ["ALPHA beta", "gamma"]);
  assert.deepEqual(lower.lines, ["ALPHA beta", "gamma"]);
  assert.deepEqual(swapped.lines, ["ALPHA beta", "GAMMA"]);
  assert.deepEqual(swapped.lastVimEdit.keys, ["g", "~", "G"]);
});

test("vim case operators do not dirty history for logical no-ops", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha"],
    cursorRow: 0,
    cursorCol: 0,
    dirty: false,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["g", "u", "i", "w"]),
  );

  assert.deepEqual(nextEditor.lines, ["alpha"]);
  assert.equal(nextEditor.dirty, false);
  assert.equal('undoStack' in nextEditor, false);
  assert.equal('redoStack' in nextEditor, false);
});

test("vim join operators merge the current line with and without spacing", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const spaced = mockEditor(mode, {
    lines: ["alpha ", "  beta", "gamma"],
    cursorRow: 0,
    cursorCol: 1,
  });
  const unspaced = mockEditor(mode, {
    lines: ["alpha", "beta"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const joined = executor.applyVimChordSyntaxToEditor(
    spaced,
    syntax.parseVimChordSyntax(["J"]),
  );
  const compact = executor.applyVimChordSyntaxToEditor(
    unspaced,
    syntax.parseVimChordSyntax(["g", "J"]),
  );

  assert.deepEqual(joined.lines, ["alpha beta", "gamma"]);
  assert.equal(joined.cursorCol, 5);
  assert.deepEqual(compact.lines, ["alphabeta"]);
  assert.equal(compact.cursorCol, 5);
});

test("vim marks store exact and line jump targets", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["first", "  second"],
    cursorRow: 1,
    cursorCol: 4,
  });

  const marked = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["m", "a"]),
  );
  const exactJump = executor.applyVimChordSyntaxToEditor(
    { ...marked, cursorRow: 0, cursorCol: 0 },
    syntax.parseVimChordSyntax(["`", "a"]),
  );
  const lineJump = executor.applyVimChordSyntaxToEditor(
    { ...marked, cursorRow: 0, cursorCol: 0 },
    syntax.parseVimChordSyntax(["'", "a"]),
  );

  assert.equal(marked.dirty, false);
  assert.deepEqual(marked.marks.a, {
    basisDigest: marked.marks.a.basisDigest,
    column: 4,
    row: 1,
  });
  assert.deepEqual(
    { row: exactJump.cursorRow, column: exactJump.cursorCol },
    { row: 1, column: 4 },
  );
  assert.deepEqual(
    { row: lineJump.cursorRow, column: lineJump.cursorCol },
    { row: 1, column: 2 },
  );
});

test("normal mode accepts interactive vim mark prefixes", async () => {
  const [mode, editing, syntax] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "editor-editing.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["first", "  second"],
    cursorRow: 1,
    cursorCol: 4,
  });

  const pendingSet = editing.updateNormalMode(editor, { key: "m" }, 80, 24);
  const marked = editing.updateNormalMode(pendingSet, { key: "a" }, 80, 24);
  const pendingExact = editing.updateNormalMode(
    { ...marked, cursorRow: 0, cursorCol: 0 },
    { key: "`" },
    80,
    24,
  );
  const exactJump = editing.updateNormalMode(pendingExact, { key: "a" }, 80, 24);
  const pendingLine = editing.updateNormalMode(
    { ...marked, cursorRow: 0, cursorCol: 0 },
    { key: "'" },
    80,
    24,
  );
  const lineJump = editing.updateNormalMode(pendingLine, { key: "a" }, 80, 24);

  assert.equal(syntax.parseVimChordSyntax(["m"]).kind, "pending");
  assert.equal(syntax.parseVimChordSyntax(["`"]).kind, "pending");
  assert.equal(syntax.parseVimChordSyntax(["'"]).kind, "pending");
  assert.deepEqual(pendingSet.pendingVimKeys, ["m"]);
  assert.deepEqual(pendingExact.pendingVimKeys, ["`"]);
  assert.deepEqual(pendingLine.pendingVimKeys, ["'"]);
  assert.equal(marked.marks.a.row, 1);
  assert.equal(marked.marks.a.column, 4);
  assert.deepEqual(
    { row: exactJump.cursorRow, column: exactJump.cursorCol },
    { row: 1, column: 4 },
  );
  assert.deepEqual(
    { row: lineJump.cursorRow, column: lineJump.cursorCol },
    { row: 1, column: 2 },
  );
});
