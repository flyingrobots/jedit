import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fakeProductionTextSession,
  hasNotification,
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

  localeChanges.length = 0;
  const [cycled] = settings.workspaceSettingsHandlers().cycleLocale(model, 1);
  assert.equal(cycled.i18n, replacementI18n);
  assert.deepEqual(localeChanges, [nextLocale.locale]);
});

test('workspace settings posts a toast when a setting changes', async () => {
  const [runtimeModule, settingsModule] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'settings.js'),
  ]);
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const localizedI18n = mockI18n({
    translations: {
      'settings.rows.line_numbers.label': 'Numéros de ligne',
      'settings.values.line_numbers_absolute': 'Absolus',
      'settings.values.line_numbers_relative': 'Relatifs',
      'settings.toast.changed_title': 'Paramètres modifiés',
    },
  });
  const [initialModel] = runtime.init();
  const [settingsOpen] = runtime.update(
    { type: 'key', key: 'f2' },
    { ...initialModel, i18n: localizedI18n },
  );
  const lineNumbersIndex = settingsModule.settingsRows(settingsOpen)
    .findIndex((row) => row.id === 'line-numbers');

  const [changed] = runtime.update(
    { type: 'key', key: 'enter' },
    { ...settingsOpen, settingsFocusIndex: lineNumbersIndex },
  );

  assert.equal(changed.lineNumberMode, 'relative');
  assert.equal(
    hasNotification(changed, 'Paramètres modifiés', 'Numéros de ligne: Absolus -> Relatifs'),
    true,
  );
});

test('workspace settings toggles dim gutter tokens and reports the change', async () => {
  const [runtimeModule, settingsModule] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'settings.js'),
  ]);
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const [initialModel] = runtime.init();
  const [settingsOpen] = runtime.update(
    { type: 'key', key: 'f2' },
    {
      ...initialModel,
      i18n: mockI18n({
        translations: {
          'settings.rows.gutter_dimmed.label': 'Dim gutter',
          'settings.values.on': 'On',
          'settings.values.off': 'Off',
          'settings.toast.changed_title': 'Settings changed',
        },
      }),
    },
  );
  const gutterIndex = settingsModule.settingsRows(settingsOpen)
    .findIndex((row) => row.id === 'gutter-dimmed');

  const [changed] = runtime.update(
    { type: 'key', key: 'enter' },
    { ...settingsOpen, settingsFocusIndex: gutterIndex },
  );

  assert.equal(changed.gutterDimmed, true);
  assert.equal(
    hasNotification(changed, 'Settings changed', 'Dim gutter: Off -> On'),
    true,
  );
});

test('workspace causal marker basis refreshes a bounded projection without mutating text authority', async () => {
  const [runtimeModule, settingsModule, authority, durability, refresh, profile] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'settings.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'workspace', 'workspace-buffer-durability.js'),
    importDist('app', 'workspace', 'workspace-causal-line-change-refresh.js'),
    importDist('app', 'text-runtime-profile.js'),
  ]);
  const mutationCalls = [];
  const lineDiffRequests = [];
  const productionTextSession = fakeProductionTextSession({
    insertText: async (request) => mutationCalls.push(['insert', request]),
    replaceRange: async (request) => mutationCalls.push(['replace', request]),
    deleteRange: async (request) => mutationCalls.push(['delete', request]),
    checkpointBuffer: async (request) => mutationCalls.push(['checkpoint', request]),
    exportSnapshot: async (request) => mutationCalls.push(['export', request]),
    observeCausalLineDiff: async (request) => {
      lineDiffRequests.push(request);
      return {
        kind: 'causal-line-diff-observed',
        reading: {
          worldlineId: 'worldline:notes',
          basisHeadId: request.basisHeadId,
          nextHeadId: request.nextHeadId,
          insertedLineCount: 1,
          deletedLineCount: 0,
          tickReceiptIds: ['tick:selected'],
          rewriteIds: ['rewrite:selected'],
          diffIds: ['diff:selected'],
          markers: [{
            lineNumber: 2,
            kind: 'INSERTED',
            tickReceiptIds: ['tick:selected'],
            rewriteIds: ['rewrite:selected'],
            diffIds: ['diff:selected'],
          }],
          deletions: [],
          observerVersion: 'test-selected-basis',
        },
      };
    },
  });
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({ productionTextSession }));
  const [initialModel] = runtime.init();
  const openedDurability = durability.openedWorkspaceBufferDurability({
    basisHeadId: 'head:import',
    hostBasis: 'file',
    materialization: 'materialized',
  });
  const currentDurability = {
    ...openedDurability,
    causal: { kind: 'admitted', headId: 'head:current' },
  };
  const openedAuthority = authority.openedWorkspaceTextAuthority({
    profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    readOnly: false,
    dirty: true,
    durability: currentDurability,
  });
  const model = {
    ...initialModel,
    i18n: mockI18n({
      translations: {
        'settings.rows.causal_gutter_basis.label': 'Causal markers',
        'settings.values.causal_gutter_import': 'Import',
        'settings.values.causal_gutter_last_save': 'Last save',
        'settings.toast.changed_title': 'Settings changed',
      },
    }),
    settingsOpen: true,
    causalGutterBasis: { kind: 'import' },
    textAuthority: openedAuthority,
  };
  const basisIndex = settingsModule.settingsRows(model)
    .findIndex((row) => row.id === 'causal-gutter-basis');

  const [changed, commands] = runtime.update(
    { type: 'key', key: 'enter' },
    { ...model, settingsFocusIndex: basisIndex },
  );

  assert.deepEqual(changed.causalGutterBasis, { kind: 'last-save' });
  assert.deepEqual(changed.textAuthority.durability.causal, currentDurability.causal);
  assert.equal(changed.textAuthority.durability.lineChanges.reason, 'observation-pending');
  assert.equal(
    hasNotification(changed, 'Settings changed', 'Causal markers: Import -> Last save'),
    true,
  );
  assert.equal(commands.length, 2, 'basis refresh and toast expiry should be scheduled');

  const refreshMessage = await commands[0]();
  assert.equal(mutationCalls.length, 0);
  assert.equal(lineDiffRequests.length, 1);
  assert.equal(lineDiffRequests[0].basisHeadId, 'head:import');
  assert.equal(lineDiffRequests[0].nextHeadId, 'head:current');

  const [refreshed] = runtime.update(refreshMessage, changed);
  assert.equal(refreshed.textAuthority.durability.lineChanges.kind, 'available');
  assert.equal(refreshed.textAuthority.durability.lineChanges.basisHeadId, 'head:import');
  assert.equal(refreshed.textAuthority.durability.lineChanges.nextHeadId, 'head:current');
  assert.deepEqual(refreshed.textAuthority.durability.causal, currentDurability.causal);

  const advanced = {
    ...refreshed,
    textAuthority: {
      ...refreshed.textAuthority,
      durability: {
        ...refreshed.textAuthority.durability,
        causal: { kind: 'admitted', headId: 'head:next' },
      },
    },
  };
  const [pendingNext, nextCommands] = refresh.ensureWorkspaceCausalLineChangeRefresh(
    advanced,
    productionTextSession,
  );
  assert.equal(pendingNext.textAuthority.durability.lineChanges.reason, 'observation-pending');
  assert.equal(pendingNext.textAuthority.durability.lineChanges.basisHeadId, 'head:import');
  assert.equal(pendingNext.textAuthority.durability.lineChanges.nextHeadId, 'head:next');
  assert.equal(nextCommands.length, 1);
});

test('workspace settings reclamps editor visibility when line-number width changes', async () => {
  const [settingsModule, editorMode, viewportModule] = await Promise.all([
    importDist('app', 'workspace', 'settings.js'),
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'viewport.js'),
  ]);
  const model = {
    columns: 60,
    rows: 16,
    fileDrawerProgress: 0,
    graftDrawerProgress: 0,
    footerVisible: true,
    lineNumberMode: 'absolute',
    editor: {
      path: '/repo/notes.txt',
      lines: Array.from({ length: 99 }, (_, index) => (index === 0 ? 'x'.repeat(80) : `line-${index}`)),
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      mode: editorMode.EditorModes.Normal,
      dirty: false,
      readOnly: false,
      pendingNormal: undefined,
      pendingVimKeys: [],
      register: '',
      registers: {},
      marks: {},
    },
  };
  const absoluteViewport = viewportModule.editorViewport(model);
  const cursorAtOldRightEdge = absoluteViewport.width - 1;
  const atEdge = {
    ...model,
    editor: {
      ...model.editor,
      cursorCol: cursorAtOldRightEdge,
    },
  };
  const relativeViewport = viewportModule.editorViewport({
    ...atEdge,
    lineNumberMode: 'relative',
  });

  const [changed] = settingsModule.workspaceSettingsHandlers().toggleLineNumberMode(atEdge);

  assert.equal(changed.lineNumberMode, 'relative');
  assert.equal(changed.editor.scrollCol, cursorAtOldRightEdge - relativeViewport.width + 1);
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
  assert.equal('History' in drawerLayout.DrawerKinds, false);
  assert.equal(panelFocus.FocusPanes.Editor, 'editor');
  assert.equal(panelFocus.FocusPanes.Files, 'files');
  assert.equal(panelFocus.FocusPanes.Graft, 'graft');
  assert.equal('History' in panelFocus.FocusPanes, false);
  assert.equal(fileSystem.FileEntryKinds.Directory, 'dir');
  assert.equal(fileSystem.FileEntryKinds.Parent, 'parent');
  assert.equal(workspaceKey.WorkspaceKeys.Backtick, '`');
  assert.equal(workspaceKey.isWorkspaceBackKey({ key: 'left' }), true);
  assert.equal(workspaceKey.isWorkspaceOpenKey({ key: 'enter' }), true);
});
