import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const README_PATH = path.join(REPO_ROOT, 'README.md');
const CODE_STANDARDS_PATH = path.join(REPO_ROOT, 'CODE_STANDARDS.md');
const FILE_SIZE_RULE_PATTERN = /\*\*File size\*\*: ≤ \*\*500 lines\*\*/;

function firstLineOf(text) {
  return text.split(/\r?\n/)[0];
}

test('README documents the Wesley checkout required for contract codegen', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  assert.match(readme, /JEDIT_WESLEY_ROOT/);
  assert.match(readme, /JEDIT_WESLEY_ROOT=.*npm run gen:contract/s);
});

test('CODE_STANDARDS starts with the runtime truth H1', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');
  const firstLine = firstLineOf(codeStandards);

  assert.equal(firstLine, '# Rule 0: Runtime Truth Wins (Non-Negotiable)');
});

test('CODE_STANDARDS mirrors enforced quality gate constraints', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');

  assert.match(codeStandards, FILE_SIZE_RULE_PATTERN);
  assert.match(codeStandards, /- \*\*Parameters\*\*: ≤ \*\*5\*\*/);
  assert.match(codeStandards, /- Max 12 imports per file/);
  assert.match(codeStandards, /- `any`\n- `unknown`/);
  assert.match(codeStandards, /- Type assertions \(`as`\)/);
  assert.match(codeStandards, /- `enum`/);
  assert.match(codeStandards, /- `throw new Error\("string"\)`/);
  assert.match(codeStandards, /- Boolean trap parameters/);
  assert.match(codeStandards, /- Anonymous option bags in public APIs/);
  assert.match(codeStandards, /@typescript-eslint\/no-restricted-types/);
  assert.doesNotMatch(codeStandards, /unknown` is allowed/);
  assert.doesNotMatch(codeStandards, /max-lines": \["error", 1000\]/);
});

test('CODE_STANDARDS documents the executable typescript-eslint floating promises rule', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');

  assert.match(codeStandards, /"@typescript-eslint\/no-floating-promises": "error"/);
  assert.doesNotMatch(codeStandards, /"no-floating-promises": "error"/);
});

test('CODE_STANDARDS heading hierarchy increments one level at a time', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');

  assert.doesNotMatch(codeStandards, /\n### Core Philosophy/);
  assert.match(codeStandards, /\n## Core Philosophy/);
});

test('CODE_STANDARDS checklist avoids repeated banned-type questions', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');

  assert.doesNotMatch(codeStandards, /Invariants protected\? No `any`\? No `unknown`\? No unsafe `as` assertions\?/);
});

test('CODE_STANDARDS first-line extraction tolerates CRLF line endings', () => {
  assert.equal(firstLineOf('# title\r\nbody'), '# title');
});

test('CODE_STANDARDS file-size matcher requires the bold field label', () => {
  assert.doesNotMatch('- File size**: ≤ **500 lines**', FILE_SIZE_RULE_PATTERN);
});
