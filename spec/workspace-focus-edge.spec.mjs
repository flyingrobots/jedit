import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'workspace-focus-edge.js');

async function loadFocusEdgeModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

function layout() {
  return {
    fileDrawer: { x: 0, width: 4 },
    viewer: { x: 4, width: 4 },
    graftDrawer: { x: 8, width: 4 },
    historyDrawer: { x: 12, width: 4 },
  };
}

function edgeToken() {
  return {
    char: '░',
    fg: '#d897ff',
    fgRGB: [216, 151, 255],
    foregroundVariables: ['accent'],
    backgroundVariables: [],
  };
}

test('workspace focus edge paints the focused editor left edge', async () => {
  const { createSurface } = await import('@flyingrobots/bijou');
  const focusEdge = await loadFocusEdgeModule();
  const surface = createSurface(12, 5, { char: '.', fg: '#111111', bg: '#222222', empty: false });

  focusEdge.paintActivePaneEdge(surface, layout(), {
    focusPane: 'editor',
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
  }, edgeToken(), {
    top: 1,
    height: 3,
  });

  assert.equal(surface.get(4, 0).char, '.');
  assert.equal(surface.get(4, 1).char, '░');
  assert.equal(surface.get(4, 1).fg, '#d897ff');
  assert.equal(surface.get(4, 1).bg, '#222222');
  assert.equal(surface.get(4, 2).char, '░');
  assert.equal(surface.get(4, 3).char, '░');
  assert.equal(surface.get(4, 4).char, '.');
  assert.equal(surface.get(0, 1).char, '.');
});

test('workspace focus edge moves to the focused graft drawer', async () => {
  const { createSurface } = await import('@flyingrobots/bijou');
  const focusEdge = await loadFocusEdgeModule();
  const surface = createSurface(12, 3, { char: '.', fg: '#111111', bg: '#222222', empty: false });

  focusEdge.paintActivePaneEdge(surface, layout(), {
    focusPane: 'graft',
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
  }, edgeToken(), {
    top: 0,
    height: 3,
  });

  assert.equal(surface.get(4, 1).char, '.');
  assert.equal(surface.get(8, 1).char, '░');
  assert.equal(surface.get(8, 1).fg, '#d897ff');
});

test('workspace focus edge moves to the focused history drawer', async () => {
  const { createSurface } = await import('@flyingrobots/bijou');
  const focusEdge = await loadFocusEdgeModule();
  const surface = createSurface(16, 3, { char: '.', fg: '#111111', bg: '#222222', empty: false });

  focusEdge.paintActivePaneEdge(surface, layout(), {
    focusPane: 'history',
    fileDrawerOpen: true,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
  }, edgeToken(), {
    top: 0,
    height: 3,
  });

  assert.equal(surface.get(8, 1).char, '.');
  assert.equal(surface.get(12, 1).char, '░');
  assert.equal(surface.get(12, 1).fg, '#d897ff');
});

test('workspace focus edge skips panes that are not visible', async () => {
  const { createSurface } = await import('@flyingrobots/bijou');
  const focusEdge = await loadFocusEdgeModule();
  const surface = createSurface(12, 3, { char: '.', fg: '#111111', bg: '#222222', empty: false });

  focusEdge.paintActivePaneEdge(surface, layout(), {
    focusPane: 'files',
    fileDrawerOpen: false,
    graftDrawerOpen: true,
    historyDrawerOpen: true,
    hasEditor: true,
  }, edgeToken(), {
    top: 0,
    height: 3,
  });

  assert.equal(surface.get(0, 1).char, '.');
});
