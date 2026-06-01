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

test('tab focus cycles across visible panes in file-editor-graft-history order', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
    focusPane: 'files',
  }), 'editor');
  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
    focusPane: 'editor',
  }), 'graft');
  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
    focusPane: 'graft',
  }), 'history');
  assert.equal(focus.cycleFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
    focusPane: 'history',
  }), 'files');
});

test('default focus prefers the editor after a pane closes', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.defaultFocusPane({
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
  }), 'editor');
  assert.equal(focus.defaultFocusPane({
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: true,
    hasEditor: false,
  }), 'history');
});

test('focus peers exist only when more than one pane is visible', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.hasFocusablePeers({
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    hasEditor: true,
    focusPane: 'editor',
  }), false);
  assert.equal(focus.hasFocusablePeers({
    fileDrawerOpen: true,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    hasEditor: true,
    focusPane: 'editor',
  }), true);
  assert.equal(focus.hasFocusablePeers({
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: true,
    hasEditor: true,
    focusPane: 'editor',
  }), true);
});

test('pending normal state clears only when focus leaves the editor', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'files'), true);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'graft'), true);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'history'), true);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'editor'), false);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('files', 'editor'), false);
});
