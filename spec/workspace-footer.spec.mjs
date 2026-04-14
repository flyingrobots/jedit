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
    drawerOpen: false,
    drawerKind: 'files',
    viewMode: 'source',
    markdownPreviewActive: true,
    editorMode: 'normal',
    pendingNormal: undefined,
  };
}

test('workspace footer shows compact uppercase normal-mode guidance', async () => {
  const footer = await loadFooterModule();

  assert.equal(
    footer.workspaceFooterLine(idleNormalState()),
    'NORMAL [i insert · o open line · f2 preview · tab files · ? hide]',
  );
});

test('workspace footer shows pending change-operator continuations', async () => {
  const footer = await loadFooterModule();

  assert.equal(
    footer.workspaceFooterLine({
      ...idleNormalState(),
      pendingNormal: 'c',
    }),
    'NORMAL c [cc line · cw word · ce word-end · c0 start · c$ end]',
  );
});

test('workspace footer shows file drawer controls with the toggle chord', async () => {
  const footer = await loadFooterModule();

  assert.equal(
    footer.workspaceFooterLine({
      drawerOpen: true,
      drawerKind: 'files',
      viewMode: 'source',
      markdownPreviewActive: false,
      editorMode: 'normal',
      pendingNormal: undefined,
    }),
    'FILES [j/k move · enter open · backspace up · tab close · ? hide]',
  );
});
