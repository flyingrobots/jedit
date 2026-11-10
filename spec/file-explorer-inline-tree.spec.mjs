import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockRuntime } from './workspace-helpers.mjs';

const src = { kind: 'dir', name: 'src', path: '/repo/src' };
const tests = { kind: 'dir', name: 'tests', path: '/repo/tests' };
const nested = { kind: 'dir', name: 'nested', path: '/repo/src/nested' };
const main = { kind: 'file', name: 'main.ts', path: '/repo/src/main.ts' };
const deep = { kind: 'file', name: 'deep.ts', path: '/repo/src/nested/deep.ts' };
const parent = { kind: 'parent', name: '..', path: '/repo' };
const key = (runtime, model, key, extra = {}) => runtime.update({ type: 'key', key, ...extra }, model);
const text = (surface) =>
  Array.from({ length: surface.height }, (_, y) =>
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join(''),
  ).join('\n');
async function setup() {
  const { createWorkspaceRuntime } = await importDist('app', 'workspace', 'runtime.js');
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  const { availableJeditThemes } = await importDist('ui', 'jedit-themes.js');
  const deps = mockRuntime();
  const reads = [];
  deps.initialModel.entries = [src, tests];
  deps.initialModel.i18n = new BijouI18nAdapter();
  deps.initialModel.jeditTheme = availableJeditThemes()[0];
  const children = new Map([
    ['/repo', [src, tests]],
    ['/repo/src', [parent, nested, main]],
    ['/repo/src/nested', [parent, deep]],
    ['/repo/tests', []],
  ]);
  deps.fileSystem.loadEntries = (path) => {
    reads.push(path);
    return children.get(path) ?? [];
  };
  const runtime = createWorkspaceRuntime(deps);
  const initial = runtime.init()[0];
  return {
    runtime,
    deps,
    reads,
    model: { ...initial, fileDrawerOpen: true, fileDrawerProgress: 1, focusPane: 'files' },
  };
}

test('Enter toggles immediate children inline and nested collapse preserves sibling branches', async () => {
  const { runtime, model, reads } = await setup();
  const [open, effects] = key(runtime, model, 'enter');
  assert.equal(open.cwd, model.cwd);
  assert.equal(open.textAuthority, model.textAuthority);
  assert.deepEqual(effects, []);
  assert.deepEqual(open.entries, [src, nested, main, tests]);
  assert.deepEqual(reads, ['/repo/src']);
  const nestedOpen = key(runtime, { ...open, selectedIndex: 1 }, 'enter')[0];
  assert.deepEqual(nestedOpen.entries, [src, nested, deep, main, tests]);
  const both = key(runtime, { ...nestedOpen, selectedIndex: 4 }, 'enter')[0];
  assert.equal(both.fileTree[tests.path].expanded, true);
  const closed = key(runtime, { ...both, selectedIndex: 0 }, 'enter')[0];
  assert.deepEqual(closed.entries, [src, tests]);
  assert.equal(closed.fileTree[tests.path].expanded, true);
  assert.equal(closed.fileTree[deep.path], undefined);
  assert.equal(closed.selectedIndex, 0);
  const reopened = key(runtime, closed, 'enter')[0];
  assert.deepEqual(reopened.entries, [src, nested, main, tests]);
});

async function listRow(index) {
  const { WORKSPACE_BODY_TOP_OFFSET, FILE_SEARCH_LIST_TOP } = await importDist('app', 'workspace', 'viewport.js');
  return WORKSPACE_BODY_TOP_OFFSET + FILE_SEARCH_LIST_TOP + index;
}
const NAME_COLUMN = 6;

test('Directory clicks toggle inline while file clicks only select and file Enter explicitly opens', async () => {
  const { runtime, model } = await setup();
  const mouse = async (model, index) =>
    runtime.update(
      { type: 'mouse', action: 'press', button: 'left', col: NAME_COLUMN, row: await listRow(index) },
      model,
    );
  const [expanded] = await mouse(model, 0);
  assert.deepEqual(expanded.entries, [src, nested, main, tests]);
  assert.equal(expanded.cwd, model.cwd);
  const [selected, effects] = await mouse(expanded, 2);
  assert.equal(selected.selectedIndex, 2);
  assert.equal(selected.entries[2], main);
  assert.equal(selected.textAuthority, model.textAuthority);
  assert.deepEqual(effects, []);
  const [opening, commands] = key(runtime, selected, 'enter');
  assert.equal(opening.textAuthority.filePath, main.path);
  assert.equal(commands.length, 1);
  assert.deepEqual((await mouse(expanded, 0))[0].entries, [src, tests]);
});

test('Right enters a child, Left selects its parent and collapses it without changing the root', async () => {
  const { runtime, model } = await setup();
  const expanded = key(runtime, model, 'right')[0];
  const child = key(runtime, expanded, 'right')[0];
  assert.equal(child.entries[child.selectedIndex], nested);
  const up = key(runtime, child, 'left')[0];
  assert.equal(up.selectedIndex, 0);
  assert.equal(up.cwd, model.cwd);
  const closed = key(runtime, up, 'left')[0];
  assert.deepEqual(closed.entries, [src, tests]);
});

test('Tree rows render nesting/disclosure and filters retain matching children with their ancestors', async () => {
  const { runtime, model } = await setup();
  let next = key(runtime, model, 'enter')[0];
  next = key(runtime, { ...next, selectedIndex: 1 }, 'enter')[0];
  const rendered = text(runtime.view(next));
  assert.match(rendered, /▾ src\//);
  assert.match(rendered, /  ▾ nested\//);
  assert.match(rendered, /    deep\.ts/);
  const { fileSearchEntries, fileSearchWithInput } = await importDist('app', 'workspace', 'file-search.js');
  const filtered = fileSearchWithInput(next, { input: 'deep', cursorIndex: 4 });
  assert.deepEqual(
    fileSearchEntries(filtered).map(({ entry }) => entry.path),
    [src.path, nested.path, deep.path],
  );
  assert.equal(filtered.entries, next.entries);
});

test('Unreadable directories preserve the tree and refresh resets expansion at the same root', async () => {
  const { runtime, model, deps } = await setup();
  deps.fileSystem.loadEntries = () => {
    throw new Error('permission denied');
  };
  const [failed] = key(runtime, model, 'enter');
  assert.equal(failed.entries, model.entries);
  assert.equal(failed.fileTree?.[src.path]?.expanded, undefined);
  assert.equal(failed.cwd, model.cwd);
  assert.notEqual(failed.notifications, model.notifications);
  const second = await setup();
  const open = key(second.runtime, second.model, 'enter')[0];
  const refreshed = key(second.runtime, open, 'r')[0];
  assert.deepEqual(refreshed.entries, [src, tests]);
  assert.equal(refreshed.fileTree, undefined);
  assert.equal(refreshed.cwd, second.model.cwd);
});

test('Filtering selects the matching file and Right uses the visible first child', async () => {
  const { runtime, model } = await setup();
  const open = key(runtime, model, 'enter')[0];
  const { fileSearchWithInput } = await importDist('app', 'workspace', 'file-search.js');
  const filtered = fileSearchWithInput(open, { input: 'main', cursorIndex: 4 });
  assert.equal(filtered.entries[filtered.selectedIndex], main);
  const next = key(runtime, { ...filtered, selectedIndex: 0 }, 'right')[0];
  assert.equal(next.entries[next.selectedIndex], main);
});

test('Left never changes the explorer root, and a filtered collapse clears the filter to keep the folder visible', async () => {
  const { runtime, model, reads } = await setup();
  const rootLeft = key(runtime, model, 'left')[0];
  assert.equal(rootLeft.cwd, model.cwd);
  assert.deepEqual(rootLeft.entries, [src, tests]);
  assert.deepEqual(reads, []);
  const expanded = key(runtime, model, 'enter')[0];
  const collapsed = key(runtime, expanded, 'left')[0];
  assert.deepEqual(collapsed.entries, [src, tests]);
  const again = key(runtime, collapsed, 'h')[0];
  assert.equal(again.cwd, model.cwd);
  assert.deepEqual(again.entries, [src, tests]);
  const { fileSearchEntries, fileSearchWithInput } = await importDist('app', 'workspace', 'file-search.js');
  const nestedOpen = key(runtime, { ...expanded, selectedIndex: 1 }, 'enter')[0];
  const filtered = fileSearchWithInput(nestedOpen, { input: 'deep', cursorIndex: 4 });
  const onAncestor = key(runtime, filtered, 'up')[0];
  assert.equal(onAncestor.entries[onAncestor.selectedIndex], nested);
  const folded = key(runtime, onAncestor, 'left')[0];
  assert.equal(folded.entries[folded.selectedIndex], nested);
  assert.equal(folded.fileSearch.input, '');
  assert.deepEqual(
    fileSearchEntries(folded).map(({ entry }) => entry),
    [src, nested, main, tests],
  );
  const parentRow = key(runtime, folded, 'left')[0];
  assert.equal(parentRow.entries[parentRow.selectedIndex], src);
  assert.equal(key(runtime, parentRow, 'left')[0].cwd, model.cwd);
});

test('The .. row moves the root up with Enter or Right while a click only selects it', async () => {
  const { runtime, deps, model } = await setup();
  const up = { kind: 'parent', name: '..', path: '/' };
  const root = { kind: 'dir', name: 'repo', path: '/repo' };
  deps.fileSystem.loadEntries = (path) => (path === '/' ? [root] : [up, src, tests]);
  const withParent = { ...model, entries: [up, src, tests], selectedIndex: 1 };
  const [clicked] = runtime.update(
    { type: 'mouse', action: 'press', button: 'left', col: NAME_COLUMN, row: await listRow(0) },
    withParent,
  );
  assert.equal(clicked.cwd, model.cwd);
  assert.equal(clicked.entries[clicked.selectedIndex], up);
  for (const keyName of ['enter', 'right', 'l']) {
    assert.equal(key(runtime, clicked, keyName)[0].cwd, '/', keyName);
  }
  assert.equal(key(runtime, clicked, 'left')[0].cwd, model.cwd);
});

test('Right or l on a file opens it like Enter', async () => {
  const { runtime, model } = await setup();
  const expanded = key(runtime, model, 'enter')[0];
  const onFile = { ...expanded, selectedIndex: expanded.entries.indexOf(main) };
  for (const keyName of ['right', 'l']) {
    const [opened, commands] = key(runtime, onFile, keyName);
    assert.equal(opened.textAuthority.filePath, main.path, keyName);
    assert.equal(commands.length, 1, keyName);
  }
});

test('Expanded tree rows never change which file :e opens or what the startup picker lists', async () => {
  const { runtime, deps, model } = await setup();
  const rootMain = { kind: 'file', name: 'main.ts', path: '/repo/main.ts' };
  deps.fileSystem.loadEntries = (path) => (path === '/repo/src' ? [parent, main] : [src, rootMain]);
  let next = key(runtime, { ...model, entries: [src, rootMain] }, 'enter')[0];
  assert.deepEqual(next.entries, [src, main, rootMain]);
  const { cwdEntries } = await importDist('app', 'workspace', 'file-tree-expansion.js');
  assert.deepEqual(cwdEntries(next), [src, rootMain]);
  next = key(runtime, next, 'b', { ctrl: true })[0];
  for (const typed of [':', 'e', 'space', 'm', 'a', 'i', 'n', '.', 't', 's']) {
    next = key(runtime, next, typed)[0];
  }
  const [opened] = key(runtime, next, 'enter');
  assert.equal(opened.textAuthority.filePath, rootMain.path);
});
