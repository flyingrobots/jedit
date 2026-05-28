import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const HELP_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'help.js');

async function loadHelpModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(HELP_PATH).href);
}

test('help text scopes scene picker shortcut to the title screen', async () => {
  const help = await loadHelpModule();
  const overlay = help.createEditorHelpOverlay(120, 40);

  assert.match(overlay.content, /ctrl\+l\s+open scene picker \(title screen only\)/);
});
