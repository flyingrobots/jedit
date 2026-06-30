import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createI18nMock } from './i18n-mock.mjs';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const SESSION_PATH = path.join(REPO_ROOT, 'dist', 'app', 'settings-session.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');

async function loadSettingsModules() {
  await ensureDistBuilt();

  return {
    settings: await import(pathToFileURL(SESSION_PATH).href),
    themes: await import(pathToFileURL(THEMES_PATH).href),
  };
}

test('jedit settings rows expose theme, footer, and markdown preview preferences', async () => {
  const { settings, themes } = await loadSettingsModules();
  const theme = themes.availableJeditThemes()[0];
  const frenchLocale = {
    locale: 'fr',
    label: 'Français',
    direction: 'ltr',
  };

  const rows = settings.jeditSettingsRows({
    i18n: createI18nMock({
      locale: frenchLocale.locale,
      localeLabel: frenchLocale.label,
      locales: [{
        locale: 'en',
        label: 'English',
        direction: 'ltr',
      }, frenchLocale],
    }),
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
  });

  assert.deepEqual(
    rows.map((row) => [row.label, row.valueLabel, row.kind, row.checked === true]),
    [
      ['English', '', settings.JEDIT_SETTING_ROW_KIND.Option, false],
      ['Français', '', settings.JEDIT_SETTING_ROW_KIND.Option, true],
      ['Theme', theme.name, settings.JEDIT_SETTING_ROW_KIND.Choice, false],
      ['Light/dark', 'Dark', settings.JEDIT_SETTING_ROW_KIND.Choice, false],
      ['Footer', 'On', settings.JEDIT_SETTING_ROW_KIND.Toggle, true],
      ['Markdown preview', 'Source', settings.JEDIT_SETTING_ROW_KIND.Choice, false],
      ['Diagnostics', 'Open', settings.JEDIT_SETTING_ROW_KIND.Choice, false],
    ],
  );
});

test('settings focus movement loops through the available rows', async () => {
  const { settings } = await loadSettingsModules();

  assert.equal(settings.moveSettingsFocusIndex(0, 1, 3), 1);
  assert.equal(settings.moveSettingsFocusIndex(2, 1, 3), 0);
  assert.equal(settings.moveSettingsFocusIndex(0, -1, 3), 2);
  assert.equal(settings.moveSettingsFocusIndex(3, 0, 3), 2);
  assert.equal(settings.moveSettingsFocusIndex(0, 1, 0), 0);
  assert.equal(settings.moveSettingsFocusIndex(4, -1, 0), 0);
});

test('settings key reducer closes, moves, and activates focused settings rows', async () => {
  const { settings, themes } = await loadSettingsModules();
  const theme = themes.availableJeditThemes()[0];
  const baseModel = {
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
    settingsOpen: true,
    settingsFocusIndex: 0,
  };
  const rows = settings.jeditSettingsRows(baseModel);
  const handlers = {
    cycleTheme(model) {
      return [{ ...model, cycled: true }, []];
    },
    toggleThemeMode(model) {
      return [{ ...model, toggledThemeMode: true }, []];
    },
    toggleFooter(model) {
      return [{ ...model, footerVisible: !model.footerVisible }, []];
    },
    toggleMarkdownPreview(model) {
      return [{ ...model, viewMode: 'preview' }, []];
    },
    openDiagnostics(model) {
      return [{ ...model, diagnosticsOpened: true }, []];
    },
    selectLocale(model, locale) {
      return [{ ...model, selectedLocale: locale.locale }, []];
    },
  };

  assert.equal(settings.toggleSettingsOpen(baseModel).settingsOpen, false);

  const [activatedLocale] = settings.updateJeditSettingsFromKey({ key: 'enter' }, baseModel, rows, handlers);
  assert.equal(activatedLocale.selectedLocale, 'en');

  const [closed] = settings.updateJeditSettingsFromKey({ key: 'escape' }, baseModel, rows, handlers);
  assert.equal(closed.settingsOpen, false);

  const [closedWithQ] = settings.updateJeditSettingsFromKey({ key: 'q' }, baseModel, rows, handlers);
  assert.equal(closedWithQ.settingsOpen, false);

  const [moved] = settings.updateJeditSettingsFromKey({ key: 'down' }, baseModel, rows, handlers);
  assert.equal(moved.settingsFocusIndex, 1);

  const [activatedMode] = settings.updateJeditSettingsFromKey({ key: 'enter' }, { ...baseModel, settingsFocusIndex: 2 }, rows, handlers);
  assert.equal(activatedMode.toggledThemeMode, true);

  const [activated] = settings.updateJeditSettingsFromKey({ key: 'enter' }, { ...baseModel, settingsFocusIndex: 4 }, rows, handlers);
  assert.equal(activated.viewMode, 'preview');

  const diagnosticsIndex = rows.findIndex((row) => row.id === 'diagnostics');
  const [diagnostics] = settings.updateJeditSettingsFromKey(
    { key: 'enter' },
    { ...baseModel, settingsFocusIndex: diagnosticsIndex },
    rows,
    handlers,
  );
  assert.equal(diagnostics.diagnosticsOpened, true);
});

test('jedit settings rows hide diagnostics when diagnostics are unavailable', async () => {
  const { settings, themes } = await loadSettingsModules();
  const theme = themes.availableJeditThemes()[0];

  const rows = settings.jeditSettingsRows({
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    diagnosticsAvailable: false,
    viewMode: 'source',
  });

  assert.equal(rows.some((row) => row.id === 'diagnostics'), false);
});
