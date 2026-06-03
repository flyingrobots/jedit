import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.ts');

test('main constructs a workspace app and runs it through bijou run()', () => {
  const source = readFileSync(MAIN_PATH, 'utf8');

  const createsAppImport = /createWorkspaceApp/.test(source);
  const createsWorkspaceApp = /const app\s*=\s*createWorkspaceApp\(/.test(source);
  const runsApp = /run\(app,/.test(source);
  const validatesTextRuntimeProfile = /requireTextRuntimeProfile\(parseTextRuntimeProfile\(\s*process\.env\[ENV_KEYS\.TextRuntime\]\s*,\s*\)\)/.test(source);
  const passesTextRuntimeProfileOption = /createWorkspaceApp\([\s\S]*textRuntimeProfile[\s\S]*\)/.test(source);
  const hasLocalSettingsHandlers = /settingsHandlers/.test(source);

  assert.ok(createsAppImport);
  assert.ok(createsWorkspaceApp);
  assert.ok(runsApp);
  assert.ok(validatesTextRuntimeProfile);
  assert.equal(passesTextRuntimeProfileOption, false);
  assert.equal(hasLocalSettingsHandlers, false);
});
