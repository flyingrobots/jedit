import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.ts');

test('main initializes settings handlers before starting the Bijou runtime', () => {
  const source = readFileSync(MAIN_PATH, 'utf8');
  const handlersIndex = source.indexOf('const settingsHandlers');
  const runIndex = source.indexOf('await run(app');

  assert.ok(handlersIndex > 0);
  assert.ok(runIndex > 0);
  assert.ok(handlersIndex < runIndex);
});
