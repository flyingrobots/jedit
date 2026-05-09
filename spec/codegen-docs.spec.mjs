import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const README_PATH = path.join(REPO_ROOT, 'README.md');

test('README documents the Wesley checkout required for contract codegen', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  assert.match(readme, /JEDIT_WESLEY_ROOT/);
  assert.match(readme, /JEDIT_WESLEY_ROOT=.*npm run gen:contract/s);
});
