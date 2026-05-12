import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const README_PATH = path.join(REPO_ROOT, 'README.md');
const CODE_STANDARDS_PATH = path.join(REPO_ROOT, 'CODE_STANDARDS.md');

test('README documents the Wesley checkout required for contract codegen', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  assert.match(readme, /JEDIT_WESLEY_ROOT/);
  assert.match(readme, /JEDIT_WESLEY_ROOT=.*npm run gen:contract/s);
});

test('CODE_STANDARDS starts with the runtime truth H1', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');
  const firstLine = codeStandards.split('\n')[0];

  assert.equal(firstLine, '# Rule 0: Runtime Truth Wins (Non-Negotiable)');
});

test('CODE_STANDARDS mirrors enforced quality gate constraints', () => {
  const codeStandards = readFileSync(CODE_STANDARDS_PATH, 'utf8');

  assert.match(codeStandards, /File size\*\*: ≤ \*\*500 lines\*\*/);
  assert.match(codeStandards, /- `any`\n- `unknown`/);
  assert.doesNotMatch(codeStandards, /unknown` is allowed/);
  assert.doesNotMatch(codeStandards, /max-lines": \["error", 1000\]/);
});
