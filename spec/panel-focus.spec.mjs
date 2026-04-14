import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'panel-focus.js');

async function loadPanelFocusModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

test('tab focus cycles across visible panes in file-editor-graft order', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    hasEditor: true,
    focusPane: 'files',
  }), 'editor');
  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    hasEditor: true,
    focusPane: 'editor',
  }), 'graft');
  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    hasEditor: true,
    focusPane: 'graft',
  }), 'files');
});

test('default focus prefers the editor after a pane closes', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.defaultFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    hasEditor: true,
  }), 'editor');
});
