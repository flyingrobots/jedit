import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.ts');
const MAIN_WORKSPACE_PATH = path.join(REPO_ROOT, 'src', 'main-workspace.ts');

test('main constructs a workspace app and runs it through bijou run()', () => {
  const source = readFileSync(MAIN_WORKSPACE_PATH, 'utf8');

  const createsAppImport = /createWorkspaceApp/.test(source);
  const createsWorkspaceApp = /const app\s*=\s*createWorkspaceApp\(/.test(source);
  const runsApp = /run\(app,/.test(source);
  const validatesTextRuntimeProfile = /requireTextRuntimeProfile\(parseTextRuntimeProfile\(\s*process\.env\[ENV_KEYS\.TextRuntime\]\s*,?\s*\)\)/.test(source);
  const createWorkspaceAppCall = source.match(/createWorkspaceApp\(\s*{[\s\S]*?}\s*\)/)?.[0] ?? '';
  const passesTextRuntimeProfileOption = /\btextRuntimeProfile\s*:/.test(createWorkspaceAppCall);
  const perfDefaultsOn = /\bperfEnabled\s*:\s*envBoolean\([\s\S]*?ENV_KEYS\.Perf[\s\S]*?defaultValue:\s*true/.test(source);
  const profileDefaultsOn = /\bprofileEnabled\s*:\s*envBoolean\([\s\S]*?ENV_KEYS\.Profile[\s\S]*?defaultValue:\s*true/.test(source);
  const hasLocalSettingsHandlers = /settingsHandlers/.test(source);

  assert.ok(createsAppImport);
  assert.ok(createsWorkspaceApp);
  assert.ok(runsApp);
  assert.ok(validatesTextRuntimeProfile);
  assert.ok(perfDefaultsOn);
  assert.ok(profileDefaultsOn);
  assert.equal(passesTextRuntimeProfileOption, false);
  assert.equal(hasLocalSettingsHandlers, false);
});

test('main bootstrap keeps startup identity checks before workspace loading', () => {
  const source = readFileSync(MAIN_PATH, 'utf8');

  assert.equal(/from '@flyingrobots\/bijou-tui'/.test(source), false);
  assert.equal(/from '\.\/adapters\/workspace-app\.js'/.test(source), false);
  assert.match(source, /jeditStartupCliAction\(process\.argv\.slice\(/);
  assert.match(source, /writeSync\(/);
  assert.match(source, /import\('\.\/main-workspace\.js'\)/);
});
