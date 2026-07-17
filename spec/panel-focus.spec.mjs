import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'panel-focus.js');

async function loadPanelFocusModule() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

test('tab focus cycles across visible file, editor, and Graft panes', async () => {
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
  assert.equal(focus.defaultFocusPane({
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    hasEditor: false,
  }), 'editor');
});

test('focus peers exist only when more than one pane is visible', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.hasFocusablePeers({
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    hasEditor: true,
    focusPane: 'editor',
  }), false);
  assert.equal(focus.hasFocusablePeers({
    fileDrawerOpen: true,
    graftDrawerOpen: false,
    hasEditor: true,
    focusPane: 'editor',
  }), true);
  assert.equal(focus.hasFocusablePeers({
    fileDrawerOpen: false,
    graftDrawerOpen: true,
    hasEditor: true,
    focusPane: 'editor',
  }), true);
});

test('pending normal state clears only when focus leaves the editor', async () => {
  const focus = await loadPanelFocusModule();

  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'files'), true);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'graft'), true);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('editor', 'editor'), false);
  assert.equal(focus.shouldClearPendingNormalOnPaneChange('files', 'editor'), false);
});
