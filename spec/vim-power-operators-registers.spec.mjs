import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
} from "./workspace-helpers.mjs";


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

test("vim word-forward operator consumes final character", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha"],
    cursorRow: 0,
    cursorCol: 4,
  });

  const deleted = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "w"]),
  );

  assert.deepEqual(deleted.lines, ["alph"]);
  assert.equal(deleted.register.text, "a");
});

test("vim horizontal operators stay within the current line", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["one", "two"],
    cursorRow: 0,
    cursorCol: 2,
  });

  const deleted = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "l"]),
  );

  assert.deepEqual(deleted.lines, ["one", "two"]);
  assert.equal(deleted.register.text, "");
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

test("vim paragraph operator motions preserve the next paragraph", async () => {
  const [mode, syntax, executor, model] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "editor", "model.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["alpha", "beta", "", "gamma"],
    cursorRow: 0,
    cursorCol: 0,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "}"]),
  );

  assert.deepEqual(nextEditor.lines, ["gamma"]);
  assert.equal(nextEditor.register.kind, model.RegisterKinds.Char);
  assert.equal(nextEditor.register.text, "alpha\nbeta\n\n");
  assert.deepEqual(nextEditor.lastVimEdit.keys, ["d", "}"]);
});

test("vim matching-pair operator motions delete the inclusive structural pair", async () => {
  const [mode, syntax, executor, model] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
    importDist("app", "workspace", "editor", "model.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["outer([alpha], beta)"],
    cursorRow: 0,
    cursorCol: 6,
  });

  const nextEditor = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["d", "%"]),
  );

  assert.deepEqual(nextEditor.lines, ["outer(, beta)"]);
  assert.equal(nextEditor.register.kind, model.RegisterKinds.Char);
  assert.equal(nextEditor.register.text, "[alpha]");
  assert.deepEqual(nextEditor.lastVimEdit.keys, ["d", "%"]);
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

test("vim EOF linewise change keeps insert on the target line", async () => {
  const [mode, syntax, executor] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-chord-syntax.js"),
    importDist("app", "workspace", "vim-command-executor.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["one", "two"],
    cursorRow: 1,
    cursorCol: 0,
  });

  const changed = executor.applyVimChordSyntaxToEditor(
    editor,
    syntax.parseVimChordSyntax(["c", "G"]),
  );

  assert.deepEqual(changed.lines, ["one", ""]);
  assert.equal(changed.cursorRow, 1);
  assert.equal(changed.cursorCol, 0);
  assert.equal(changed.mode, mode.EditorModes.Insert);
  assert.equal(changed.register.text, "two");
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
