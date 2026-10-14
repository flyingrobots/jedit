import assert from 'node:assert/strict';
import test from 'node:test';
import { QUIT } from '@flyingrobots/bijou-tui';
import { importDist, mockRuntime } from './workspace-helpers.mjs';

const ENTRIES = [
  { kind: 'parent', name: '..', path: '/repo' },
  { kind: 'dir', name: 'components', path: '/repo/src/components' },
  { kind: 'file', name: 'alpha.txt', path: '/repo/src/alpha.txt' },
  { kind: 'file', name: 'index.ts', path: '/repo/src/index.ts' },
  { kind: 'file', name: 'render-tree.ts', path: '/repo/src/render-tree.ts' },
  { kind: 'file', name: 'readme.md', path: '/repo/src/readme.md' },
];
const key = (key, flags = {}) => ({ type: 'key', key, ...flags });

async function setup(options = {}) {
  const { createWorkspaceRuntime } = await importDist('app', 'workspace', 'runtime.js');
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  const { availableJeditThemes } = await importDist('ui', 'jedit-themes.js');
  const deps = mockRuntime(options.deps);
  deps.initialModel.entries = options.entries ?? ENTRIES;
  deps.initialModel.i18n = new BijouI18nAdapter().withLocale(options.locale ?? 'en');
  deps.initialModel.jeditTheme = availableJeditThemes()[0];
  const runtime = createWorkspaceRuntime(deps);
  const initial = { ...runtime.init()[0], cwd: '/repo/src', startupIntroComplete: true };
  const [opened] = runtime.update(key('b', { ctrl: true }), initial);
  const focused = options.navigation ? opened : runtime.update(key('/'), opened)[0];
  return { runtime, initial, model: { ...focused, fileDrawerProgress: 1 } };
}

function type(runtime, model, input) {
  for (const character of input) model = runtime.update(key(character), model)[0];
  return model;
}

function text(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')
  )).join('\n');
}

async function drawer(model, width = 32, height = 12) {
  const { renderDrawer } = await importDist('app', 'workspace', 'viewer-drawers.js');
  return renderDrawer('files', model, width, height);
}

test('slash focuses a sticky search input with a visible caret', async () => {
  const { model } = await setup();
  assert.equal(model.focusPane, 'files');
  assert.deepEqual(model.fileSearch, { input: '', cursorIndex: 0 });
  const surface = await drawer(model);
  assert.match(text(surface).split('\n')[1], /Search: Filter files/);
  assert.equal(surface.get(9, 1).bg, model.jeditTheme.cursor.insert.bg);
});

test('typing fuzzy-filters loaded relative paths without mutating the source list', async () => {
  const { runtime, model } = await setup();
  const next = type(runtime, model, 'SRC/RNT');
  assert.equal(next.fileSearch.input, 'SRC/RNT');
  assert.equal(next.entries, model.entries);
  assert.equal(next.selectedIndex, 4);
  const rendered = text(await drawer(next));
  assert.match(rendered, /render-tree\.ts/);
  assert.doesNotMatch(rendered, /alpha\.txt|index\.ts|readme\.md|components\/|\.\.\//);
});

test('plain shortcut characters belong to the focused search field while Ctrl+C still quits', async () => {
  const { runtime, model } = await setup();
  let next = model;
  for (const character of 'qjkrh:l` ') {
    const [updated, commands] = runtime.update(key(character), next);
    assert.deepEqual(commands, []);
    assert.equal(updated.quitConfirmOpen, false);
    assert.equal(updated.perfVisible, false);
    next = updated;
  }
  assert.equal(next.fileSearch.input, 'qjkrh:l` ');
  const [, commands] = runtime.update(key('c', { ctrl: true }), next);
  assert.equal(await commands[0](), QUIT);
});

test('the query caret edits Unicode text and supports clearing without leaving the directory', async () => {
  const { runtime, model } = await setup();
  let next = type(runtime, model, 'a🦀界');
  next = runtime.update(key('left'), next)[0];
  next = runtime.update(key('backspace'), next)[0];
  assert.deepEqual(next.fileSearch, { input: 'a界', cursorIndex: 1 });
  next = runtime.update(key('delete'), next)[0];
  assert.deepEqual(next.fileSearch, { input: 'a', cursorIndex: 1 });
  next = runtime.update(key('home'), next)[0];
  next = type(runtime, next, 'é');
  assert.equal(next.fileSearch.input, 'éa');
  next = runtime.update(key('u', { ctrl: true }), next)[0];
  assert.deepEqual(next.fileSearch, { input: '', cursorIndex: 0 });
  assert.equal(next.cwd, '/repo/src');
  next = runtime.update(key('backspace'), next)[0];
  assert.equal(next.cwd, '/repo/src');
});

test('arrows select visible matches and Enter opens the displayed file, including no-match safety', async () => {
  const { runtime, model } = await setup();
  let next = type(runtime, model, '.ts');
  assert.equal(next.selectedIndex, 3);
  next = runtime.update(key('down'), next)[0];
  assert.equal(next.selectedIndex, 4);
  next = runtime.update(key('escape'), next)[0];
  const [opening, commands] = runtime.update(key('enter'), next);
  assert.equal(opening.textAuthority.filePath, '/repo/src/render-tree.ts');
  assert.equal(commands.length, 1);
  const empty = type(runtime, model, 'not-a-match');
  assert.match(text(await drawer(empty)), /No matches/);
  const [unchanged, none] = runtime.update(key('enter'), empty);
  assert.equal(unchanged.textAuthority, empty.textAuthority);
  assert.equal(unchanged.selectedIndex, -1);
  assert.deepEqual(none, []);
});

test('the input stays pinned while the filtered list scrolls and caret text scrolls horizontally', async () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ kind: 'file', name: `entry-${i}.ts`, path: `/repo/src/entry-${i}.ts` }));
  const { runtime, model } = await setup({ entries });
  let next = type(runtime, model, 'en');
  const initialHeader = text(await drawer(next, 28, 10)).split('\n')[1];
  for (let i = 0; i < 22; i += 1) next = runtime.update(key('down'), next)[0];
  const rendered = text(await drawer(next, 28, 10)).split('\n');
  assert.equal(rendered[1], initialHeader);
  assert.ok(rendered.some((line) => line.includes('› entry-22.ts')));
  next = runtime.update(key('u', { ctrl: true }), next)[0];
  next = type(runtime, next, 'a'.repeat(40) + 'tail');
  assert.match(text(await drawer(next, 28, 10)).split('\n')[1], /tail/);
});

test('filtered result clicks and wheel selection use the pinned-header geometry', async () => {
  const { runtime, model } = await setup();
  const filtered = type(runtime, model, '.ts');
  const [clicked] = runtime.update({ type: 'mouse', action: 'press', button: 'left', col: 5, row: 6 }, filtered);
  assert.equal(clicked.selectedIndex, 4);
  assert.equal(clicked.textAuthority, model.textAuthority);
  const [wheeled] = runtime.update({ type: 'mouse', action: 'scroll-down', button: 'none', col: 5, row: 8 }, filtered);
  assert.equal(wheeled.selectedIndex, 4);
  const [inputClick, commands] = runtime.update({ type: 'mouse', action: 'press', button: 'left', col: 10, row: 3 }, {
    ...filtered, focusPane: 'editor',
  });
  assert.equal(inputClick.focusPane, 'files');
  assert.deepEqual(commands, []);
  assert.equal(inputClick.textAuthority, model.textAuthority);
});

test('close/reopen retains the query, directory changes clear it, and failed changes retain it', async () => {
  const { runtime, model } = await setup({ deps: { fileSystem: {
    loadEntries: (cwd) => { if (cwd === '/repo/src/components') throw new Error('unreadable'); return ENTRIES; },
    dirname: () => '/repo', join: (...parts) => parts.join('/'), resolve: (...parts) => parts.join('/'),
    describeDirectoryIssue: () => ({ title: 'Directory failed', message: 'unreadable' }),
  } } });
  let next = type(runtime, model, 'rnt');
  next = runtime.update(key('b', { ctrl: true }), next)[0];
  assert.equal(next.fileDrawerOpen, false);
  next = runtime.update(key('b', { ctrl: true }), next)[0];
  assert.equal(next.focusPane, 'files');
  assert.equal(next.fileSearch.input, 'rnt');
  next = runtime.update(key('up', { alt: true }), next)[0];
  assert.equal(next.cwd, '/repo');
  assert.equal(next.fileSearch.input, '');
  const failed = type(runtime, model, 'components');
  const [after] = runtime.update(key('enter'), runtime.update(key('escape'), failed)[0]);
  assert.equal(after.cwd, '/repo/src');
  assert.equal(after.fileSearch.input, 'components');
  assert.equal(after.entries, model.entries);
});

test('Settings and pane focus take ownership without changing the search query', async () => {
  const { runtime, model } = await setup();
  const filtered = type(runtime, model, 'rnt');
  const settings = runtime.update(key('f2'), filtered)[0];
  assert.equal(settings.settingsOpen, true);
  assert.equal(type(runtime, settings, 'q').fileSearch.input, 'rnt');
  const unfocused = { ...filtered, focusPane: 'editor' };
  const surface = await drawer(unfocused);
  assert.equal(surface.get(12, 1).bg, model.jeditTheme.surface.currentLine.bg);
  assert.equal(unfocused.fileSearch.input, 'rnt');
});

test('refresh keeps the query and no-match pointer actions cannot open a hidden file', async () => {
  const { runtime, model } = await setup();
  const filtered = type(runtime, model, 'rnt');
  const refreshed = runtime.update(key('r', { ctrl: true }), filtered)[0];
  assert.deepEqual(refreshed.fileSearch, filtered.fileSearch);
  const empty = type(runtime, model, 'zzzzzz');
  for (const action of ['press', 'scroll-down', 'scroll-up']) {
    const [next, commands] = runtime.update({ type: 'mouse', action, button: 'left', col: 5, row: 6 }, empty);
    assert.equal(next.selectedIndex, -1);
    assert.equal(next.textAuthority, empty.textAuthority);
    assert.deepEqual(commands, []);
  }
});

test('localized labels fit narrow fields and wide-character clicks use display columns', async () => {
  const { fileSearchCursorAtColumn } = await importDist('ui', 'file-search-input.js');
  const { fileSearchInputOptions } = await importDist('app', 'workspace', 'file-explorer-view.js');
  for (const locale of ['en', 'ja', 'ar', 'me']) {
    const { runtime, model } = await setup({ locale });
    const next = type(runtime, model, '界x');
    const options = fileSearchInputOptions(next, 28);
    const surface = await drawer(next, 30, 8);
    assert.match(text(surface).split('\n')[1], /界x/);
    assert.ok(!options.label.includes('fileExplorer.'));
    const { visibleLineLength } = await importDist('ui', 'fit-line.js');
    const prefix = visibleLineLength(`${options.label}: `);
    assert.equal(fileSearchCursorAtColumn(options, prefix + 2), 1);
    assert.equal(fileSearchCursorAtColumn(options, prefix + 3), 2);
  }
});

test('the input has a distinct background and only fuzzy-matched letters receive the accent', async () => {
  const { runtime, model } = await setup({ entries: [ENTRIES[4], { ...ENTRIES[4], name: 'render-test.ts', path: '/repo/src/render-test.ts' }] });
  const filtered = type(runtime, model, 'rnt');
  const surface = await drawer(filtered);
  assert.notEqual(surface.get(2, 1).bg, surface.get(2, 3).bg);
  assert.equal(surface.get(2, 1).bg, model.jeditTheme.surface.currentLine.bg);
  for (const x of [3, 5, 10]) {
    assert.equal(surface.get(x, 3).fg, surface.get(4, 3).fg);
    assert.equal(surface.get(x, 4).fg, model.jeditTheme.chrome.activeEdge.fg);
    assert.ok(surface.get(x, 3).modifiers.includes('bold'));
  }
  assert.equal(surface.get(4, 4).fg, model.jeditTheme.surface.drawer.fg);
  const cleared = runtime.update(key('u', { ctrl: true }), filtered)[0];
  const plain = await drawer(cleared);
  assert.equal(plain.get(3, 4).fg, model.jeditTheme.surface.drawer.fg);
});

test('the input background remains distinct across built-in dark and light themes', async () => {
  const { availableJeditThemes, oppositeJeditTheme } = await importDist('ui', 'jedit-themes.js');
  const { model } = await setup();
  for (const theme of availableJeditThemes().flatMap((theme) => [theme, oppositeJeditTheme(theme)])) {
    const surface = await drawer({ ...model, jeditTheme: theme });
    assert.notEqual(surface.get(2, 1).bg, surface.get(2, 3).bg, theme.name);
  }
});

 test('Files opens in navigation mode, slash edits, and Escape returns to navigation before closing', async () => {
  const { runtime, model } = await setup({ navigation: true });
  assert.equal(model.fileSearchEditing, false);
  let next = runtime.update(key('j'), model)[0];
  assert.equal(next.selectedIndex, 1);
  assert.equal(next.fileSearch.input, '');
  next = runtime.update(key('k'), next)[0];
  assert.equal(next.selectedIndex, 0);
  next = runtime.update(key('/'), next)[0];
  assert.equal(next.fileSearchEditing, true);
  next = type(runtime, next, '.ts');
  next = runtime.update(key('escape'), next)[0];
  assert.equal(next.fileDrawerOpen, true);
  assert.equal(next.fileSearchEditing, false);
  assert.equal(next.fileSearch.input, '.ts');
  next = runtime.update(key('j'), next)[0];
  assert.equal(next.selectedIndex, 4);
  next = runtime.update(key('escape'), next)[0];
  assert.equal(next.fileDrawerOpen, false);
});

 test('mouse hover is separate from selection and clicking selects without opening', async () => {
  const { runtime, model } = await setup({ navigation: true });
  const [hover, commands] = runtime.update({ type: 'mouse', action: 'move', button: 'none', col: 5, row: 7 }, model);
  assert.equal(hover.fileHoveredIndex, 2);
  assert.equal(hover.selectedIndex, 0);
  assert.deepEqual(commands, []);
  const surface = await drawer(hover);
  assert.notEqual(surface.get(2, 3).bg, surface.get(2, 5).bg);
  const [selected] = runtime.update({ type: 'mouse', action: 'press', button: 'left', col: 5, row: 7 }, hover);
  assert.equal(selected.selectedIndex, 2);
  assert.equal(selected.focusPane, 'files');
  assert.equal(selected.textAuthority, model.textAuthority);
  const [outside] = runtime.update({ type: 'mouse', action: 'move', button: 'none', col: 80, row: 7 }, selected);
  assert.equal(outside.fileHoveredIndex, undefined);
});

 test('portable paths from the filesystem boundary exclude drive and workspace text from filtering', async () => {
  const { portableFileSearchPath } = await importDist('adapters', 'filesystem.js');
  const { runtime, model } = await setup({ entries: [{
    kind: 'file', name: 'index.ts', path: 'C:\\repo\\src\\index.ts',
    searchPath: portableFileSearchPath('C:\\repo\\src\\index.ts'),
  }] });
  const initial = { ...model, workspaceRoot: 'C:\\repo', workspaceSearchRoot: portableFileSearchPath('C:\\repo') };
  assert.equal(type(runtime, initial, 'src/index').selectedIndex, 0);
  assert.equal(type(runtime, initial, 'repo').selectedIndex, -1);
});

 test('selected rows remain readable and distinct from hover across dark and light themes', async () => {
  const { availableJeditThemes, oppositeJeditTheme } = await importDist('ui', 'jedit-themes.js');
  const { contrastRatio } = await importDist('ui', 'theme-contrast.js');
  const { model } = await setup({ navigation: true });
  for (const theme of availableJeditThemes().flatMap((theme) => [theme, oppositeJeditTheme(theme)])) {
    const surface = await drawer({ ...model, jeditTheme: theme, selectedIndex: 1, fileHoveredIndex: 2 });
    const selected = surface.get(3, 4);
    const hovered = surface.get(3, 5);
    assert.notEqual(selected.bg, hovered.bg, theme.name);
    assert.ok(contrastRatio(selected.fgRGB, selected.bgRGB) >= 4.45, theme.name);
  }
});
