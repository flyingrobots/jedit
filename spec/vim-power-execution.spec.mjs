import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
} from "./workspace-helpers.mjs";

test("vim motion resolver resolves counted reading-basis motions", async () => {
  const [mode, motion] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-motion-resolver.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha beta gamma", "delta echo"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const countedWord = motion.resolveVimMotion({
    editor,
    motion: "wordForward",
    count: 2,
  });
  const currentLines = motion.resolveVimMotion({
    editor,
    motion: "lineCurrent",
    count: 2,
  });

  assert.equal("obstruction" in countedWord, false);
  assert.equal("obstruction" in currentLines, false);
  assert.deepEqual(countedWord.cursorAfter, { row: 0, column: 11 });
  assert.deepEqual(countedWord.target, { start: 0, end: 11 });
  assert.doesNotMatch(countedWord.basisDigest, /alpha/);
  assert.equal(currentLines.targetShape, "linewise");
  assert.deepEqual(currentLines.target, { start: 0, end: 27 });
});

test("vim file-top motion honors explicit counts", async () => {
  const [mode, motion] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-motion-resolver.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["one", "two", "three", "four"],
    cursorRow: 3,
    cursorCol: 0,
  });

  const countedTop = motion.resolveVimMotion({
    editor,
    motion: "fileTop",
    count: 3,
  });

  assert.equal("obstruction" in countedTop, false);
  assert.deepEqual(countedTop.cursorAfter, { row: 2, column: 0 });
  assert.deepEqual(countedTop.target, { start: 8, end: 18 });
});

test("vim text object resolver targets words and delimiter interiors", async () => {
  const [mode, textObjects] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-text-object-resolver.js"),
  ]);
  const quoted = mockEditor(mode, {
    lines: ['const value = "hello world";'],
    cursorRow: 0,
    cursorCol: 16,
  });
  const paren = mockEditor(mode, {
    lines: ["call(alpha, beta)"],
    cursorRow: 0,
    cursorCol: 8,
  });

  const innerQuote = textObjects.resolveVimTextObject({
    editor: quoted,
    scope: "inner",
    target: "doubleQuote",
  });
  const aroundParen = textObjects.resolveVimTextObject({
    editor: paren,
    scope: "around",
    target: "paren",
  });

  assert.equal("obstruction" in innerQuote, false);
  assert.equal("obstruction" in aroundParen, false);
  assert.deepEqual(innerQuote.targetRange, { start: 15, end: 26 });
  assert.deepEqual(aroundParen.targetRange, { start: 4, end: 17 });
});

test("vim operator compiler deletes motion ranges with register provenance", async () => {
  const [mode, syntax, executor, model] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "editor", "model.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha beta gamma", "delta echo"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "w"]),
  );

  assert.deepEqual(nextEditor.lines, ["beta gamma", "delta echo"]);
  assert.equal(nextEditor.register.kind, model.RegisterKinds.Char);
  assert.equal(nextEditor.register.text, "alpha ");
  assert.equal(nextEditor.register.source.operation, "delete");
  assert.deepEqual(nextEditor.lastVimEdit.keys, ["d", "w"]);
});

test("vim backward operator motions leave the cursor character intact", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const wordEditor = mockEditor(mode, {
    lines: ["alpha beta"],
    cursorRow: 0,
    cursorCol: 6,
  });
  const charEditor = mockEditor(mode, {
    lines: ["abc"],
    cursorRow: 0,
    cursorCol: 1,
  });

  const wordDeleted = executor.applyVimChordSyntaxToEditor(
    wordEditor,
    syntax.parseVimChordSyntax(["d", "b"]),
  );
  const charDeleted = executor.applyVimChordSyntaxToEditor(
    charEditor,
    syntax.parseVimChordSyntax(["d", "h"]),
  );

  assert.deepEqual(wordDeleted.lines, ["beta"]);
  assert.equal(wordDeleted.register.text, "alpha ");
  assert.deepEqual(charDeleted.lines, ["bc"]);
  assert.equal(charDeleted.register.text, "a");
});

test("vim linewise operator motions expand to full line ranges", async () => {
  const [mode, syntax, executor, model] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "editor", "model.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["one", "two", "three"],
    cursorRow: 1,
    cursorCol: 1,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "G"]),
  );

  assert.deepEqual(nextEditor.lines, ["one"]);
  assert.equal(nextEditor.register.kind, model.RegisterKinds.Line);
  assert.equal(nextEditor.register.text, "two\nthree");
});

test("vim uppercase WORD motions treat punctuation as part of a WORD", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["foo.bar baz"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["W"]),
  );

  assert.equal(nextEditor.cursorCol, 8);
});

test("vim text-object change clears the target and enters insert mode", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ['const value = "hello";'],
    cursorRow: 0,
    cursorCol: 16,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["c", "i", '"']),
  );

  assert.deepEqual(nextEditor.lines, ['const value = "";']);
  assert.equal(nextEditor.mode, mode.EditorModes.Insert);
  assert.equal(nextEditor.cursorCol, 15);
  assert.equal(nextEditor.register.text, "hello");
});

test("vim counted word text objects expand over multiple words", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["one two three four"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["3", "c", "a", "w"]),
  );

  assert.deepEqual(nextEditor.lines, ["four"]);
  assert.equal(nextEditor.register.text, "one two three ");
  assert.equal(nextEditor.mode, mode.EditorModes.Insert);
});

test("vim named line registers put without creating phantom blank lines", async () => {
  const [mode, syntax, executor, model] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "editor", "model.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["first", "second"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const yanked = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(['"', "a", "y", "y"]),
  );
  const pasted = executor.applyVimChordSyntaxToEditor(
    { ...yanked, cursorRow: 1, cursorCol: 0 },
    syntax.parseVimChordSyntax(['"', "a", "p"]),
  );

  assert.equal(yanked.register.kind, model.RegisterKinds.Line);
  assert.equal(yanked.registers.a.text, "first");
  assert.deepEqual(pasted.lines, ["first", "second", "first"]);
  assert.equal(pasted.cursorRow, 2);
});

test("vim standalone line operators honor named registers", async () => {
  const [mode, syntax, executor, model] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "editor", "model.js"),
  ]);
  const yEditor = mockEditor(mode, {
    lines: ["first", "second"],
    cursorRow: 0,
    cursorCol: 0,
  });
  const dEditor = mockEditor(mode, {
    lines: ["alpha beta"],
    cursorRow: 0,
    cursorCol: 6,
  });
  const cEditor = mockEditor(mode, {
    lines: ["alpha beta"],
    cursorRow: 0,
    cursorCol: 6,
  });

  const yanked = executor.applyVimChordSyntaxToEditor(
    yEditor,
    syntax.parseVimChordSyntax(['"', "a", "Y"]),
  );
  const deleted = executor.applyVimChordSyntaxToEditor(
    dEditor,
    syntax.parseVimChordSyntax(['"', "b", "D"]),
  );
  const changed = executor.applyVimChordSyntaxToEditor(
    cEditor,
    syntax.parseVimChordSyntax(['"', "c", "C"]),
  );

  assert.equal(yanked.register.kind, model.RegisterKinds.Line);
  assert.equal(yanked.registers.a.text, "first");
  assert.deepEqual(deleted.lines, ["alpha "]);
  assert.equal(deleted.registers.b.text, "beta");
  assert.deepEqual(changed.lines, ["alpha "]);
  assert.equal(changed.registers.c.text, "beta");
  assert.equal(changed.mode, mode.EditorModes.Insert);
});

test("vim explicit missing named register put does not fall back to unnamed", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["one", "two"],
    cursorRow: 1,
    cursorCol: 0,
    register: { kind: "line", text: "one" },
    registers: {},
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(['"', "a", "p"]),
  );

  assert.deepEqual(nextEditor.lines, ["one", "two"]);
  assert.equal(nextEditor.cursorRow, 1);
});

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
    undoStack: [],
    redoStack: [],
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["g", "u", "i", "w"]),
  );

  assert.deepEqual(nextEditor.lines, ["alpha"]);
  assert.equal(nextEditor.dirty, false);
  assert.equal(nextEditor.undoStack.length, 0);
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
