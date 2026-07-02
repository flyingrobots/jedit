import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

const SEQUENCER_SOURCE = `${REPO_ROOT}/src/app/workspace/workspace-text-operation-sequencer.ts`;
const SEQUENCER_FACTORY = 'export function createWorkspaceTextOperationSequencer(';
const NEXT_FUNCTION = '\nfunction sequenceWorkspaceTextOperation';

test('workspace text operation sequencer is factory-owned, not module-owned', async () => {
  const source = await readFile(SEQUENCER_SOURCE, 'utf8');
  const factoryStart = source.indexOf(SEQUENCER_FACTORY);
  assert.notEqual(factoryStart, -1);
  const nextFunctionStart = source.indexOf(NEXT_FUNCTION, factoryStart);
  assert.notEqual(nextFunctionStart, -1);
  const moduleScopeBeforeFactory = source.slice(0, factoryStart);
  const factorySource = source.slice(factoryStart, nextFunctionStart);

  assert.doesNotMatch(moduleScopeBeforeFactory, /new WeakMap/);
  assert.match(factorySource, /queues:\s*new WeakMap/);
  assert.match(factorySource, /obstructions:\s*new WeakMap/);
  assert.match(factorySource, /exports:\s*new WeakMap/);
  assert.match(factorySource, /operationSequences:\s*new WeakMap/);
});
