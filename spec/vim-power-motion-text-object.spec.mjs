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

test("vim paragraph motions resolve blank-line reading-basis boundaries", async () => {
  const [mode, motion] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-motion-resolver.js"),
  ]);
  const lines = ["alpha", "beta", "", "gamma", "delta", "", "omega"];
  const editor = mockEditor(mode, {
    lines,
    cursorRow: 0,
    cursorCol: 0,
  });
  const bodyEditor = mockEditor(mode, {
    lines,
    cursorRow: 4,
    cursorCol: 2,
  });

  const next = motion.resolveVimMotion({
    editor,
    motion: "paragraphForward",
  });
  const countedNext = motion.resolveVimMotion({
    editor,
    motion: "paragraphForward",
    count: 2,
  });
  const previous = motion.resolveVimMotion({
    editor: bodyEditor,
    motion: "paragraphBackward",
  });

  assert.equal("obstruction" in next, false);
  assert.equal("obstruction" in countedNext, false);
  assert.equal("obstruction" in previous, false);
  assert.deepEqual(next.cursorAfter, { row: 3, column: 0 });
  assert.deepEqual(next.target, { start: 0, end: 12 });
  assert.equal(next.targetShape, "charwise");
  assert.match(next.basisDigest, /^vim-basis:/);
  assert.deepEqual(countedNext.cursorAfter, { row: 6, column: 0 });
  assert.deepEqual(previous.cursorAfter, { row: 3, column: 0 });
  assert.deepEqual(previous.target, { start: 12, end: 20 });
});

test("vim matching-pair motion exposes structural pair identity", async () => {
  const [mode, motion] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-motion-resolver.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ["call(alpha, [beta])"],
    cursorRow: 0,
    cursorCol: 12,
  });

  const resolved = motion.resolveVimMotion({
    editor,
    motion: "matchingPair",
  });

  assert.equal("obstruction" in resolved, false);
  assert.deepEqual(resolved.cursorAfter, { row: 0, column: 17 });
  assert.deepEqual(resolved.target, { start: 12, end: 18 });
  assert.deepEqual(resolved.structuralPair, {
    close: "]",
    closeIndex: 17,
    direction: "forward",
    open: "[",
    openIndex: 12,
    originIndex: 12,
    pairId: "vim-pair:12:17:[]",
    policy: "balanced-bracket-pair-v1",
  });
  assert.match(resolved.basisDigest, /^vim-basis:/);
});

test("vim repeat-search motions expose match identity", async () => {
  const [mode, motion] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-motion-resolver.js"),
  ]);
  const lines = ["alpha beta", "gamma beta", "beta"];
  const pattern = "beta";
  const patternDigest = motion.vimMotionBasisDigest([pattern]);
  const editor = mockEditor(mode, {
    lines,
    cursorRow: 0,
    cursorCol: 0,
    lastSearch: {
      direction: "forward",
      pattern,
      searchId: "search-1",
    },
  });
  const middleEditor = mockEditor(mode, {
    lines,
    cursorRow: 1,
    cursorCol: 6,
    lastSearch: {
      direction: "forward",
      pattern,
      searchId: "search-1",
    },
  });

  const next = motion.resolveVimMotion({
    editor,
    motion: "nextSearch",
  });
  const countedNext = motion.resolveVimMotion({
    editor,
    motion: "nextSearch",
    count: 2,
  });
  const previous = motion.resolveVimMotion({
    editor: middleEditor,
    motion: "previousSearch",
  });

  assert.equal("obstruction" in next, false);
  assert.equal("obstruction" in countedNext, false);
  assert.equal("obstruction" in previous, false);
  assert.deepEqual(next.cursorAfter, { row: 0, column: 6 });
  assert.deepEqual(next.searchMatch, {
    direction: "forward",
    end: 10,
    matchId: `vim-search-match:${patternDigest}:forward:6:10:1`,
    matchOrdinal: 1,
    patternDigest,
    patternKind: "literal",
    policy: "literal-wrap-v1",
    searchId: "search-1",
    start: 6,
  });
  assert.deepEqual(countedNext.cursorAfter, { row: 1, column: 6 });
  assert.equal(countedNext.searchMatch.matchOrdinal, 2);
  assert.deepEqual(previous.cursorAfter, { row: 0, column: 6 });
  assert.equal(previous.searchMatch.direction, "backward");
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

test("vim quoted text objects ignore escaped delimiters", async () => {
  const [mode, textObjects] = await Promise.all([
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "vim-text-object-resolver.js"),
  ]);
  const editor = mockEditor(mode, {
    lines: ['const value = "he\\"llo";'],
    cursorRow: 0,
    cursorCol: 19,
  });

  const innerQuote = textObjects.resolveVimTextObject({
    editor,
    scope: "inner",
    target: "doubleQuote",
  });

  assert.equal("obstruction" in innerQuote, false);
  assert.deepEqual(innerQuote.targetRange, { start: 15, end: 22 });
});
