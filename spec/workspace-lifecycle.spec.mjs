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

  const [selected] = settings.workspaceSettingsHandlers().selectLocale(model, nextLocale);

  assert.notEqual(selected, model);
  assert.notEqual(selected.i18n, model.i18n);
  assert.equal(selected.i18n, replacementI18n);
  assert.deepEqual(localeChanges, [nextLocale.locale]);
});

test('workspace settings opens and refreshes the Graft diagnostics panel', async () => {
  const [runtimeModule, settingsModule, diagnosticsPort] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'settings.js'),
    importDist('ports', 'graft-diagnostics.js'),
  ]);
  const report = {
    title: 'Graft diagnostics',
    summary: 'Colorful prose projection is active.',
    rows: [{
      label: 'Graft package',
      value: '0.10.0',
      status: diagnosticsPort.GRAFT_DIAGNOSTIC_STATUS.Ok,
    }],
  };
  let loadCount = 0;
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    graftDiagnostics: {
      loadDiagnostics: async () => {
        loadCount += 1;
        return report;
      },
      failedDiagnostics: ({ message }) => ({
        title: 'Graft diagnostics',
        summary: message,
        rows: [],
      }),
    },
  }));
  const [initialModel] = runtime.init();
  const [settingsOpen] = runtime.update({ type: 'key', key: 'f2' }, initialModel);
  const diagnosticsIndex = settingsModule.settingsRows(settingsOpen).findIndex((row) => row.id === 'diagnostics');

  const [opened, commands] = runtime.update(
    { type: 'key', key: 'enter' },
    { ...settingsOpen, settingsFocusIndex: diagnosticsIndex },
  );
  const [loaded] = runtime.update(await commands[0](), opened);
  const [refreshed, refreshCommands] = runtime.update({ type: 'key', key: 'enter' }, loaded);
  const [refreshedLoaded] = runtime.update(await refreshCommands[0](), refreshed);
  const [backToSettings] = runtime.update({ type: 'key', key: 'escape' }, refreshedLoaded);
  const [closedFromDiagnostics] = runtime.update({ type: 'key', key: 'q' }, refreshedLoaded);
  const [closedFromSettings] = runtime.update({ type: 'key', key: 'q' }, backToSettings);

  assert.equal(opened.settingsDiagnosticsOpen, true);
  assert.equal(opened.graftDiagnosticsLoading, true);
  assert.equal(loaded.graftDiagnostics, report);
  assert.equal(loaded.graftDiagnosticsLoading, false);
  assert.equal(refreshed.graftDiagnosticsLoading, true);
  assert.equal(refreshedLoaded.graftDiagnostics, report);
  assert.equal(backToSettings.settingsDiagnosticsOpen, false);
  assert.equal(backToSettings.settingsOpen, true);
  assert.equal(closedFromDiagnostics.settingsDiagnosticsOpen, false);
  assert.equal(closedFromDiagnostics.settingsOpen, false);
  assert.equal(closedFromSettings.settingsOpen, false);
  assert.equal(loadCount, 2);
});

test('workspace diagnostics failure report receives the failed request message', async () => {
  const [runtimeModule, settingsModule] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'settings.js'),
  ]);
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    graftDiagnostics: {
      loadDiagnostics: async () => {
        throw new Error('diagnostics crashed');
      },
      failedDiagnostics: ({ message }) => ({
        title: 'Graft diagnostics',
        summary: message,
        rows: [],
      }),
    },
  }));
  const [initialModel] = runtime.init();
  const diagnosticsIndex = settingsModule.settingsRows(initialModel).findIndex((row) => row.id === 'diagnostics');
  const [opened, commands] = runtime.update(
    { type: 'key', key: 'enter' },
    { ...initialModel, settingsOpen: true, settingsFocusIndex: diagnosticsIndex },
  );
  const [loaded] = runtime.update(await commands[0](), opened);

  assert.equal(loaded.graftDiagnostics.summary, 'diagnostics crashed');
  assert.equal(loaded.graftDiagnosticsLoading, false);
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
