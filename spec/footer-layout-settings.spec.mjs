import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockRuntime } from './workspace-helpers.mjs';
const key = (key) => ({ type: 'key', key });

async function setup(overrides = {}) {
  const { createWorkspaceRuntime } = await importDist('app', 'workspace', 'runtime.js');
  const { availableJeditThemes } = await importDist('ui', 'jedit-themes.js');
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  const deps = mockRuntime();
  deps.initialModel.jeditTheme = availableJeditThemes()[0];
  deps.initialModel.i18n = new BijouI18nAdapter();
  const runtime = createWorkspaceRuntime(deps);
  return { runtime, model: { ...runtime.init()[0], startupIntroComplete: true, ...overrides } };
}
function row(surface, y) {
  return Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('');
}

test('Appearance chooses all three layouts in either direction without losing settings focus', async () => {
  const { runtime, model } = await setup();
  assert.equal(model.footerLayout, 'focused');
  const { settingsRows } = await importDist('app', 'workspace', 'settings.js');
  let next = runtime.update(key('f2'), model)[0];
  const index = settingsRows(next).findIndex((row) => row.id === 'footer-layout');
  assert.ok(index >= 0);
  next = { ...next, settingsFocusIndex: index };
  for (const expected of ['per-pane', 'compact', 'focused']) {
    next = runtime.update(key('right'), next)[0];
    assert.equal(next.footerLayout, expected);
    assert.equal(next.settingsFocusIndex, index);
    assert.equal(next.settingsOpen, true);
    assert.equal(next.textAuthority, model.textAuthority);
  }
  next = runtime.update(key('left'), next)[0];
  assert.equal(next.footerLayout, 'compact');
  next = runtime.update(key('escape'), next)[0];
  assert.equal(next.footerLayout, 'compact');
});

test('Compact returns a body row and hiding the footer preserves the selected layout', async () => {
  const { workspaceBodyHeight } = await importDist('app', 'workspace', 'viewport.js');
  assert.equal(workspaceBodyHeight({ rows: 16, footerVisible: true, footerLayout: 'compact' }), 13);
  assert.equal(workspaceBodyHeight({ rows: 16, footerVisible: true, footerLayout: 'focused' }), 12);
  assert.equal(workspaceBodyHeight({ rows: 16, footerVisible: true, footerLayout: 'per-pane' }), 12);
  assert.equal(workspaceBodyHeight({ rows: 16, footerVisible: false, footerLayout: 'compact' }), 14);
});

test('Focused follows Files mode and retains observed workspace counts', async () => {
  const { runtime, model } = await setup({
    fileDrawerOpen: true, fileDrawerProgress: 1, focusPane: 'files', fileSearchEditing: true,
    entries: [{ kind: 'file', name: 'one.ts', path: '/repo/one.ts' }], selectedIndex: 0,
  });
  const surface = runtime.view(model);
  assert.match(row(surface, model.rows - 2), /\//);
  assert.match(row(surface, model.rows - 1), /0 modified/);
});

test('Per-pane segments align with visible pane boundaries', async () => {
  const { runtime, model } = await setup({
    footerLayout: 'per-pane', columns: 100, fileDrawerOpen: true, fileDrawerProgress: 1,
    graftDrawerOpen: true, graftDrawerProgress: 1, focusPane: 'files',
  });
  const { resolveWorkspaceLayout } = await importDist('ui', 'drawer-layout.js');
  const layout = resolveWorkspaceLayout(100, 1, 1);
  const surface = runtime.view(model);
  const line = row(surface, model.rows - 2);
  assert.match(line.slice(layout.fileDrawer.x, layout.fileDrawer.x + layout.fileDrawer.width), /FILES/);
  assert.match(line.slice(layout.viewer.x, layout.viewer.x + layout.viewer.width), /BROWSE/);
  assert.match(line.slice(layout.graftDrawer.x), /GRAFT/);
  assert.notEqual(surface.get(0, model.rows - 2).fg, surface.get(layout.viewer.x, model.rows - 2).fg);
});

test('Compact retains global counts during command entry at narrow width', async () => {
  const { runtime, model } = await setup({
    footerLayout: 'compact', columns: 60, rows: 16,
    commandLine: { active: true, input: 'edit src/', cursorIndex: 9, selectedCompletionIndex: 0 },
  });
  const line = row(runtime.view(model), 15);
  assert.match(line, /:edit src\//);
  assert.match(line, /0 modified/);
});

test('Saving a footer choice updates the model only on success and reports failure', async () => {
  const { workspaceSettingsHandlers, settingsRows } = await importDist('app', 'workspace', 'settings.js');
  const { updateSettingsKey } = await importDist('app', 'workspace', 'settings-key-bindings.js');
  const { model } = await setup({ settingsOpen: true });
  const calls = [];
  const footerPreferences = { load: () => 'focused', save: (value) => { calls.push(value); return { ok: true }; } };
  const handlers = workspaceSettingsHandlers({ footerPreferences });
  assert.equal(handlers.cycleFooterLayout(model, 1)[0].footerLayout, 'per-pane');
  assert.deepEqual(calls, ['per-pane']);
  const before = { ...model, settingsFocusIndex: settingsRows(model).findIndex((row) => row.id === 'footer-layout') };
  const [failed, commands] = updateSettingsKey(key('right'), before, {
    deps: { footerPreferences: { ...footerPreferences, save: () => ({ ok: false }) } },
    nowMs: () => 100, createNotificationTickCmd: () => () => undefined,
  });
  assert.equal(failed.footerLayout, 'focused');
  assert.equal(failed.textAuthority, before.textAuthority);
  assert.equal(failed.settingsFocusIndex, before.settingsFocusIndex);
  assert.ok(commands.length > 0);
  const text = JSON.stringify(failed.notifications);
  assert.match(text, /Could not save ~\/.jimrc/);
  assert.doesNotMatch(text, /Settings changed/);
});

test('The extra Compact body row uses the same list mapping for pointer selection', async () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ kind: 'file', name: `file-${i}.ts`, path: `/repo/file-${i}.ts` }));
  const { runtime, model } = await setup({ columns: 60, rows: 16, entries, selectedIndex: 10,
    footerLayout: 'compact', fileDrawerOpen: true, fileDrawerProgress: 1, focusPane: 'files' });
  const { workspaceBodyHeight, fileSearchListHeight, listScrollOffset, FILE_SEARCH_LIST_TOP, WORKSPACE_BODY_TOP_OFFSET } = await importDist('app', 'workspace', 'viewport.js');
  const listHeight = fileSearchListHeight(workspaceBodyHeight(model));
  const rowIndex = listHeight - 1;
  const expectedIndex = listScrollOffset(10, entries.length, listHeight) + rowIndex;
  const selected = runtime.update({ type: 'mouse', action: 'press', button: 'left', col: 2,
    row: WORKSPACE_BODY_TOP_OFFSET + FILE_SEARCH_LIST_TOP + rowIndex }, model)[0];
  assert.equal(selected.selectedIndex, expectedIndex);
  assert.equal(selected.fileSearchEditing, false);
});

test('All layouts preserve observations and mode ownership at narrow and RTL sizes', async () => {
  const { workspaceFooterPresentation } = await importDist('ui', 'workspace-footer-presentation.js');
  const { model, runtime } = await setup({ columns: 60, rows: 16,
    fileDrawerOpen: true, fileDrawerProgress: 1, graftDrawerOpen: true, graftDrawerProgress: 1, focusPane: 'files',
    editor: { path: '/repo/very-long-name-that-can-clip.ts', lines: ['test'], cursorRow: 80, cursorCol: 40, mode: 'normal', dirty: true, readOnly: true },
    fileSearch: { input: 'test', cursorIndex: 4 }, entries: [{ kind: 'file', name: 'test.ts', path: '/repo/test.ts' }],
  });
  for (const locale of ['en', 'ar', 'me']) for (const footerLayout of ['focused', 'per-pane', 'compact']) {
    const next = { ...model, footerLayout, i18n: model.i18n.withLocale(locale) };
    const facts = workspaceFooterPresentation(next);
    assert.equal(facts.focused.identity, '/repo/test.ts');
    assert.doesNotMatch(facts.focused.detail, /81:41/);
    const surface = runtime.view(next);
    assert.equal(surface.width, 60);
    assert.equal(surface.height, 16);
    assert.equal(next.editor, model.editor);
    assert.equal(next.textAuthority, model.textAuthority);
    assert.equal(next.fileSearch, model.fileSearch);
    assert.doesNotMatch(row(surface, 15), /footer\.status|settings\.values/);
  }
});

test('Compact separates cursor and global counts and keeps the filename when its parent path clips', async () => {
  const { runtime, model } = await setup({ footerLayout: 'compact', columns: 60, rows: 16,
    editor: { path: '/repo/a-very-long-parent-directory/another-directory/main.ts', lines: ['text'],
      cursorRow: 0, cursorCol: 0, scrollRow: 0, scrollCol: 0, mode: 'normal', dirty: false, readOnly: false } });
  const line = row(runtime.view(model), 15);
  assert.match(line, /main\.ts/);
  assert.match(line, /1:1  0 modified/);
});

test('Command completion moves down with Compact and stays above the input row', async () => {
  const { runtime, model } = await setup({ columns: 60, rows: 16,
    entries: [{ kind: 'file', name: 'alpha.ts', path: '/repo/alpha.ts' }],
    commandLine: { active: true, input: 'edit ', cursorIndex: 5, selectedCompletionIndex: 0 } });
  const markerRow = (surface) => Array.from({ length: surface.height }, (_, y) => y)
    .find((y) => row(surface, y).includes('› alpha.ts'));
  const focused = markerRow(runtime.view({ ...model, footerLayout: 'focused' }));
  const pane = markerRow(runtime.view({ ...model, footerLayout: 'per-pane' }));
  const compact = markerRow(runtime.view({ ...model, footerLayout: 'compact' }));
  assert.ok(focused !== undefined);
  assert.equal(pane, focused);
  assert.equal(compact, focused + 1);
  assert.ok(compact < 15);
});
