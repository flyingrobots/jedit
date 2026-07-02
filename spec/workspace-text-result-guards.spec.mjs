import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const RESULT_GUARDS_PATH = path.join(
  REPO_ROOT,
  'dist',
  'app',
  'workspace',
  'workspace-text-result-guards.js',
);

async function loadResultGuards() {
  await ensureDistBuilt();
  return import(pathToFileURL(RESULT_GUARDS_PATH).href);
}

test('dependent edit blocker issue does not synthesize request zero', async () => {
  const guards = await loadResultGuards();

  assert.equal(
    guards.dependentEditBlockedIssue('/repo/notes.txt', undefined, 123).message,
    'Text edit blocked by obstructed intent: /repo/notes.txt: request:unknown',
  );
  assert.equal(
    guards.dependentEditBlockedIssue('/repo/notes.txt', 7, 123).message,
    'Text edit blocked by obstructed intent: /repo/notes.txt: request:7',
  );
});
