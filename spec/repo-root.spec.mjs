import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT, discoverRepoRoot } from './dist-helpers.mjs';

test('the repo root is discovered, not assumed from the launch directory', () => {
  assert.equal(discoverRepoRoot(path.join(REPO_ROOT, 'spec')), REPO_ROOT);
  assert.equal(discoverRepoRoot(path.join(REPO_ROOT, 'src', 'ui')), REPO_ROOT);
});

test('discovery falls back to the given directory outside a work tree', () => {
  assert.equal(discoverRepoRoot('/'), '/');
});
