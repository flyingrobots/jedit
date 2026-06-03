import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const HELP_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'help.js');

async function loadHelpModule() {
  await ensureDistBuilt();

  return import(pathToFileURL(HELP_PATH).href);
}

test('help text scopes scene picker shortcut to the title screen', async () => {
  const help = await loadHelpModule();
  const overlay = help.createEditorHelpOverlay(120, 40);

  assert.match(overlay.content, /ctrl\+l\s+open scene picker \(title screen only\)/);
});
