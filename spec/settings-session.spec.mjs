import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const SESSION_PATH = path.join(REPO_ROOT, 'dist', 'app', 'settings-session.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');

async function loadSettingsModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    settings: await import(pathToFileURL(SESSION_PATH).href),
    themes: await import(pathToFileURL(THEMES_PATH).href),
  };
}

test('jedit settings rows expose theme, footer, and markdown preview preferences', async () => {
  const { settings, themes } = await loadSettingsModules();
  const theme = themes.availableJeditThemes()[0];

  const rows = settings.jeditSettingsRows({
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    viewMode: 'source',
  });

  assert.deepEqual(
    rows.map((row) => [row.label, row.valueLabel, row.kind]),
    [
      ['Theme', theme.name, settings.JEDIT_SETTING_ROW_KIND.Choice],
      ['Footer', 'On', settings.JEDIT_SETTING_ROW_KIND.Toggle],
      ['Markdown preview', 'Source', settings.JEDIT_SETTING_ROW_KIND.Choice],
    ],
  );
});

test('settings focus movement clamps to the available rows', async () => {
  const { settings } = await loadSettingsModules();

  assert.equal(settings.moveSettingsFocusIndex(0, 1, 3), 1);
  assert.equal(settings.moveSettingsFocusIndex(2, 1, 3), 2);
  assert.equal(settings.moveSettingsFocusIndex(0, -1, 3), 0);
  assert.equal(settings.moveSettingsFocusIndex(3, 0, 3), 2);
});

test('settings key reducer closes, moves, and activates focused settings rows', async () => {
  const { settings, themes } = await loadSettingsModules();
  const theme = themes.availableJeditThemes()[0];
  const baseModel = {
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    viewMode: 'source',
    settingsOpen: true,
    settingsFocusIndex: 0,
  };
  const rows = settings.jeditSettingsRows(baseModel);
  const handlers = {
    cycleTheme(model) {
      return [{ ...model, cycled: true }, []];
    },
    toggleFooter(model) {
      return [{ ...model, footerVisible: !model.footerVisible }, []];
    },
    toggleMarkdownPreview(model) {
      return [{ ...model, viewMode: 'preview' }, []];
    },
  };

  assert.equal(settings.toggleSettingsOpen(baseModel).settingsOpen, false);

  const [closed] = settings.updateJeditSettingsFromKey({ key: 'escape' }, baseModel, rows, handlers);
  assert.equal(closed.settingsOpen, false);

  const [moved] = settings.updateJeditSettingsFromKey({ key: 'down' }, baseModel, rows, handlers);
  assert.equal(moved.settingsFocusIndex, 1);

  const [activated] = settings.updateJeditSettingsFromKey({ key: 'enter' }, { ...baseModel, settingsFocusIndex: 2 }, rows, handlers);
  assert.equal(activated.viewMode, 'preview');
});
