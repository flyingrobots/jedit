import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockI18n,
} from './workspace-helpers.mjs';

test('graft lifecycle command awaits close connection', async () => {
  const graft = await importDist('app', 'workspace', 'graft.js');
  let closed = false;
  const command = graft.manageGraftLifecycle(async () => {
    closed = true;
  });

  const result = await command();

  assert.equal(closed, true);
  assert.equal(result, undefined);
});

test('graft lifecycle command returns a runtime issue when close fails', async () => {
  const graft = await importDist('app', 'workspace', 'graft.js');
  const command = graft.manageGraftLifecycle(async () => {
    throw new Error('close failed');
  }, () => 321);

  const result = await command();

  assert.equal(result.type, 'runtime-issue');
  assert.equal(result.issue.level, 'error');
  assert.equal(result.issue.source, 'command');
  assert.equal(result.issue.atMs, 321);
});

test('workspace settings exposes locale and direction runtime tokens', async () => {
  const settings = await importDist('app', 'workspace', 'settings.js');
  const localeChanges = [];
  const nextLocale = {
    locale: 'fr',
    label: 'Francais',
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
      setLocale: (locale, direction) => {
        localeChanges.push({ locale, direction });
      },
    }),
  };

  settings.workspaceSettingsHandlers.toggleLocale(model);

  assert.deepEqual(localeChanges, [{
    locale: nextLocale.locale,
    direction: nextLocale.direction,
  }]);
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
