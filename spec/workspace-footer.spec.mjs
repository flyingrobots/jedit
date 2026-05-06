import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'workspace-chrome.js');

async function loadFooterModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

function idleNormalState() {
  return {
    focusPane: 'editor',
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    viewMode: 'source',
    markdownPreviewActive: true,
    editorMode: 'normal',
    pendingNormal: undefined,
    cwd: '/repo',
    selectedEntry: undefined,
    editorPath: '/repo/notes/todo.md',
    graftPath: undefined,
    graftSelection: undefined,
  };
}

test('workspace footer shows compact uppercase normal-mode guidance', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines(idleNormalState()),
    [
      'NORMAL [i insert · o open line · f2 preview · ctrl+t theme]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer shows pending change-operator continuations', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      pendingNormal: 'c',
    }),
    [
      'NORMAL c [cc line · cw word · ce word-end · c0 start · c$ end]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer explains that tab indents when no peer panes are visible in insert mode', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      editorMode: 'insert',
    }),
    [
      'INSERT [text input · esc normal · ctrl+s save · ctrl+t theme · tab indent]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer shows file drawer controls and the selected file path', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      focusPane: 'files',
      fileDrawerOpen: true,
      graftDrawerOpen: false,
      viewMode: 'source',
      markdownPreviewActive: false,
      editorMode: 'normal',
      pendingNormal: undefined,
      cwd: '/repo',
      selectedEntry: {
        kind: 'file',
        name: 'very-long-file-name.md',
        path: '/repo/notes/very-long-file-name.md',
      },
      editorPath: '/repo/notes/todo.md',
      graftPath: undefined,
      graftSelection: undefined,
    }),
    [
      'FILES [j/k move · enter open · backspace up · ctrl+b close · ctrl+t theme · tab focus]',
      '/repo/notes/very-long-file-name.md',
    ],
  );
});
