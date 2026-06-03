import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockI18n,
  mockRuntime,
} from './workspace-helpers.mjs';

test('workspace runtime init does not schedule a Graft sidecar lifecycle command', async () => {
  const runtimeModule = await importDist('app', 'workspace', 'runtime.js');
  let closed = false;
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    graftSession: {
      loadGraftInfo: async () => ({
        path: '/repo/main.md',
        relativePath: 'main.md',
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      failedGraftInfo: () => ({
        path: '/repo/main.md',
        relativePath: 'main.md',
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      closeConnection: async () => {
        closed = true;
      },
    },
  }));

  const [, commands] = runtime.init();

  assert.equal(commands.length, 1);
  assert.equal(closed, false);
});

test('workspace settings selects a locale through runtime tokens', async () => {
  const settings = await importDist('app', 'workspace', 'settings.js');
  const localeChanges = [];
  const replacementI18n = mockI18n({
    locale: 'fr',
    localeLabel: 'Français',
  });
  const nextLocale = {
    locale: 'fr',
    label: 'Français',
    direction: settings.WorkspaceTextDirections.Ltr,
  };
  const model = {
    i18n: mockI18n({
      locale: settings.WorkspaceLocales.Default,
      locales: [{
        locale: settings.WorkspaceLocales.Default,
        label: 'English',
        direction: settings.WorkspaceTextDirections.Ltr,
      }, nextLocale],
      setLocale: (locale) => {
        localeChanges.push(locale);
      },
      withLocale: (locale) => {
        localeChanges.push(locale);
        return replacementI18n;
      },
    }),
  };

  const [selected] = settings.workspaceSettingsHandlers.selectLocale(model, nextLocale);

  assert.notEqual(selected, model);
  assert.notEqual(selected.i18n, model.i18n);
  assert.equal(selected.i18n, replacementI18n);
  assert.deepEqual(localeChanges, [nextLocale.locale]);
});

test('workspace exposes runtime tokens for drawer, focus, file entry, and key dispatch values', async () => {
  const [drawerLayout, panelFocus, fileSystem, workspaceKey] = await Promise.all([
    importDist('ui', 'drawer-layout.js'),
    importDist('ui', 'panel-focus.js'),
    importDist('ports', 'file-system.js'),
    importDist('app', 'workspace', 'workspace-key.js'),
  ]);

  assert.equal(drawerLayout.DrawerKinds.Files, 'files');
  assert.equal(drawerLayout.DrawerKinds.Graft, 'graft');
  assert.equal(drawerLayout.DrawerKinds.History, 'history');
  assert.equal(panelFocus.FocusPanes.Editor, 'editor');
  assert.equal(panelFocus.FocusPanes.Files, 'files');
  assert.equal(panelFocus.FocusPanes.Graft, 'graft');
  assert.equal(panelFocus.FocusPanes.History, 'history');
  assert.equal(fileSystem.FileEntryKinds.Directory, 'dir');
  assert.equal(fileSystem.FileEntryKinds.Parent, 'parent');
  assert.equal(workspaceKey.WorkspaceKeys.Backtick, '`');
  assert.equal(workspaceKey.isWorkspaceBackKey({ key: 'left' }), true);
  assert.equal(workspaceKey.isWorkspaceOpenKey({ key: 'enter' }), true);
});
