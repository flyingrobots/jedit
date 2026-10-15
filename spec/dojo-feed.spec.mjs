import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockRuntime } from './workspace-helpers.mjs';

async function setup(overrides = {}) {
  const { createWorkspaceRuntime } = await importDist('app', 'workspace', 'runtime.js');
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  const { availableJeditThemes } = await importDist('ui', 'jedit-themes.js');
  const deps = mockRuntime();
  deps.initialModel.i18n = new BijouI18nAdapter();
  deps.initialModel.jeditTheme = availableJeditThemes()[0];
  const runtime = createWorkspaceRuntime(deps);
  return { runtime, model: { ...runtime.init()[0], ...overrides } };
}
const key = (runtime, model, key, extra = {}) => runtime.update({ type: 'key', key, ...extra }, model);
const text = (surface) => Array.from({ length: surface.height }, (_, y) =>
  Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')).join('\n');

test('Dojo Feed opens disconnected and restores the underlying editor without effects', async () => {
  const editor = { path: '/repo/main.ts', lines: ['unsaved'], mode: 'insert', dirty: true, cursorRow: 0, cursorCol: 3, scrollRow: 0, scrollCol: 0 };
  const { runtime, model } = await setup({ editor });
  const [opened, effects] = key(runtime, model, 'f4');
  assert.deepEqual(opened.dojoFeedDrawer, { scrollRow: 0 });
  assert.deepEqual(effects, []);
  for (const input of ['x', 'j', 'tab', ':', 'enter', 'f2']) {
    const [next, commands] = key(runtime, opened, input);
    assert.equal(next.editor, editor);
    assert.equal(next.textAuthority, model.textAuthority);
    assert.equal(next.focusPane, model.focusPane);
    assert.deepEqual(commands, []);
    assert.ok(next.dojoFeedDrawer);
  }
  for (const close of ['escape', 'f4']) {
    const [closed, commands] = key(runtime, opened, close);
    assert.equal(closed.dojoFeedDrawer, undefined);
    assert.equal(closed.editor, editor);
    assert.deepEqual(commands, []);
  }
  const rendered = text(runtime.view(opened));
  assert.match(rendered, /Dojo Feed/);
  assert.match(rendered, /Waiting for public feed/);
  assert.match(rendered, /Disconnected/);
  assert.doesNotMatch(rendered, /Connected|Retry|Connect now/);
});

test('Dojo Feed respects existing modal owners and ends Files editing without losing its query', async () => {
  const { runtime, model } = await setup();
  for (const overlay of [{ settingsOpen: true }, { startupFileModalOpen: true }, { commandLine: { ...model.commandLine, active: true } }]) {
    assert.equal(key(runtime, { ...model, ...overlay }, 'f4')[0].dojoFeedDrawer, undefined);
  }
  const filtering = { ...model, fileDrawerOpen: true, fileDrawerProgress: 1, focusPane: 'files', fileSearchEditing: true,
    fileSearch: { input: 'main', cursorIndex: 4 } };
  const opened = key(runtime, filtering, 'f4')[0];
  assert.ok(opened.dojoFeedDrawer);
  assert.equal(opened.fileSearchEditing, false);
  assert.equal(opened.fileSearch, filtering.fileSearch);
});

test('Dojo Feed owns pointer input and shares its pinned close target with the renderer', async () => {
  const { runtime, model } = await setup({ columns: 60, rows: 12, fileDrawerOpen: true, fileDrawerProgress: 1, focusPane: 'files' });
  const opened = key(runtime, model, 'f4')[0];
  const mouse = (extra) => runtime.update({ type: 'mouse', action: 'press', button: 'left', col: 3, row: 4, ...extra }, opened);
  assert.equal(mouse({})[0].selectedIndex, opened.selectedIndex);
  assert.equal(mouse({ action: 'move' })[0].fileHoveredIndex, opened.fileHoveredIndex);
  const { dojoFeedLayout } = await importDist('ui', 'dojo-feed-drawer.js');
  const layout = dojoFeedLayout(opened);
  assert.match(text(runtime.view(opened)), /j\/k scroll/);
  const [scrolled, effects] = mouse({ action: 'scroll-down', col: layout.x + 2, row: layout.y + 5 });
  assert.ok(scrolled.dojoFeedDrawer.scrollRow > 0);
  assert.deepEqual(effects, []);
  const end = key(runtime, opened, 'end')[0];
  assert.ok(end.dojoFeedDrawer.scrollRow > 0);
  assert.equal(key(runtime, end, 'home')[0].dojoFeedDrawer.scrollRow, 0);
  const [closed] = mouse({ col: layout.closeX, row: layout.closeY });
  assert.equal(closed.dojoFeedDrawer, undefined);
});

test('Dojo Feed renders bounded themed cells, localized state and footer identity in every layout', async () => {
  const { runtime, model } = await setup({ columns: 60, rows: 16 });
  const { availableJeditThemes, oppositeJeditTheme } = await importDist('ui', 'jedit-themes.js');
  for (const locale of model.i18n.locales) {
    const i18n = model.i18n.withLocale(locale.locale);
    assert.notEqual(i18n.t('dojoFeed.waiting'), 'dojoFeed.waiting');
    const next = key(runtime, { ...model, i18n }, 'f4')[0];
    const surface = runtime.view(next);
    assert.equal(surface.width, 60);
    assert.equal(surface.height, 16);
    assert.match(text(surface), /127\.0\.0\.1:4747/);
  }
  for (const footerLayout of ['focused', 'per-pane', 'compact']) {
    const opened = key(runtime, { ...model, footerLayout }, 'f4')[0];
    const footer = text(runtime.view(opened)).split('\n').slice(-2).join('\n');
    assert.match(footer, /DOJO FEED/);
  }
  for (const theme of availableJeditThemes()) {
    for (const jeditTheme of [theme, oppositeJeditTheme(theme)]) {
      const opened = key(runtime, { ...model, jeditTheme }, 'f4')[0];
      const { dojoFeedLayout } = await importDist('ui', 'dojo-feed-drawer.js');
      const layout = dojoFeedLayout(opened);
      const surface = runtime.view(opened);
      assert.equal(surface.get(layout.x, layout.y).bg, jeditTheme.surface.drawer.bg);
    }
  }
});


test('Dojo Feed keeps a hidden footer hidden and still closes below the minimum terminal size', async () => {
  const { runtime, model } = await setup({ footerVisible: false });
  const opened = key(runtime, model, 'f4')[0];
  const { workspaceFooterRows } = await importDist('app', 'workspace', 'viewport.js');
  assert.equal(workspaceFooterRows(opened), 0);
  assert.match(text(runtime.view(opened)), /Disconnected/);
  const tiny = { ...opened, columns: 30, rows: 8 };
  assert.doesNotThrow(() => runtime.view(tiny));
  assert.equal(key(runtime, tiny, 'escape')[0].dojoFeedDrawer, undefined);
  assert.ok(key(runtime, opened, 'c', { ctrl: true })[1].length > 0);
});

test('Pointer input outside Dojo Feed cannot scroll or edit the underlying source', async () => {
  const editor = { path: '/repo/main.ts', lines: Array.from({ length: 50 }, () => 'text'), mode: 'normal', dirty: true,
    cursorRow: 10, cursorCol: 1, scrollRow: 4, scrollCol: 0 };
  const { runtime, model } = await setup({ editor, columns: 100, rows: 24 });
  const opened = key(runtime, model, 'f4')[0];
  for (const action of ['press', 'move', 'scroll-down', 'scroll-up']) {
    const [next, effects] = runtime.update({ type: 'mouse', action, button: 'left', col: 2, row: 4 }, opened);
    assert.equal(next.editor, editor);
    assert.equal(next.dojoFeedDrawer, opened.dojoFeedDrawer);
    assert.deepEqual(effects, []);
  }
});
