import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

const SEQUENCER_SOURCE = `${REPO_ROOT}/src/app/workspace/workspace-text-operation-sequencer.ts`;

test('workspace text operation sequencer is factory-owned, not module-owned', async () => {
  const source = await readFile(SEQUENCER_SOURCE, 'utf8');
  assert.match(source, /export function createWorkspaceTextOperationSequencer\(/);
  assert.doesNotMatch(source, /^const .* = new WeakMap/m);
});
