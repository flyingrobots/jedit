import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createI18nMock } from './i18n-mock.mjs';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const KEYBINDINGS_PATH = path.join(REPO_ROOT, 'dist', 'app', 'keybindings.js');
const SESSION_PATH = path.join(REPO_ROOT, 'dist', 'app', 'settings-session.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');

async function loadSettingsModules() {
  await ensureDistBuilt();

  return {
    keybindings: await import(pathToFileURL(KEYBINDINGS_PATH).href),
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
    lineNumberMode: 'absolute',
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
  });

  assert.deepEqual(
    rows.map((row) => [row.label, row.valueLabel, row.kind, row.checked === true]),
    [
      ['Language', '< Français > 2/2', settings.JEDIT_SETTING_ROW_KIND.Choice, false],
      ['Theme', theme.name, settings.JEDIT_SETTING_ROW_KIND.Choice, false],
      ['Light/dark', 'Dark', settings.JEDIT_SETTING_ROW_KIND.Choice, false],
      ['Footer', 'On', settings.JEDIT_SETTING_ROW_KIND.Toggle, true],
      ['Line numbers', 'Absolute', settings.JEDIT_SETTING_ROW_KIND.Choice, false],
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
  const { keybindings, settings, themes } = await loadSettingsModules();
  const theme = themes.availableJeditThemes()[0];
  const baseModel = {
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    lineNumberMode: 'absolute',
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
    toggleLineNumberMode(model) {
      return [{ ...model, lineNumberMode: 'relative' }, []];
    },
    toggleMarkdownPreview(model) {
      return [{ ...model, viewMode: 'preview' }, []];
    },
    openDiagnostics(model) {
      return [{ ...model, diagnosticsOpened: true }, []];
    },
    cycleLocale(model, delta) {
      return [{ ...model, localeDelta: delta }, []];
    },
    selectLocale(model, locale) {
      return [{ ...model, selectedLocale: locale.locale }, []];
    },
  };

  assert.equal(settings.toggleSettingsOpen(baseModel).settingsOpen, false);

  const [activatedLocale] = settings.updateJeditSettingsFromKey({ key: 'enter' }, baseModel, rows, handlers);
  assert.equal(activatedLocale.localeDelta, 1);

  const [previousLocale] = settings.updateJeditSettingsFromKey({ key: 'left' }, baseModel, rows, handlers);
  assert.equal(previousLocale.localeDelta, -1);

  const [closed] = settings.updateJeditSettingsFromKey({ key: 'escape' }, baseModel, rows, handlers);
  assert.equal(closed.settingsOpen, false);

  const [closedWithQ] = settings.updateJeditSettingsFromKey(
    { key: keybindings.JEDIT_SETTINGS_CLOSE_KEY },
    baseModel,
    rows,
    handlers,
  );
  assert.equal(closedWithQ.settingsOpen, false);

  const [moved] = settings.updateJeditSettingsFromKey({ key: 'down' }, baseModel, rows, handlers);
  assert.equal(moved.settingsFocusIndex, 1);

  const [activatedMode] = settings.updateJeditSettingsFromKey({ key: 'enter' }, { ...baseModel, settingsFocusIndex: 2 }, rows, handlers);
  assert.equal(activatedMode.toggledThemeMode, true);

  const lineNumbersIndex = rows.findIndex((row) => row.id === 'line-numbers');
  const [lineNumbers] = settings.updateJeditSettingsFromKey(
    { key: 'enter' },
    { ...baseModel, settingsFocusIndex: lineNumbersIndex },
    rows,
    handlers,
  );
  assert.equal(lineNumbers.lineNumberMode, 'relative');

  const markdownIndex = rows.findIndex((row) => row.id === 'markdown-preview');
  const [activated] = settings.updateJeditSettingsFromKey({ key: 'enter' }, { ...baseModel, settingsFocusIndex: markdownIndex }, rows, handlers);
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
    lineNumberMode: 'absolute',
    markdownPreviewActive: true,
    diagnosticsAvailable: false,
    viewMode: 'source',
  });

  assert.equal(rows.some((row) => row.id === 'diagnostics'), false);
});
