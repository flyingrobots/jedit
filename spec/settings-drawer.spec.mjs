import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createI18nMock } from './i18n-mock.mjs';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const DRAWER_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'settings-drawer.js');
const SESSION_PATH = path.join(REPO_ROOT, 'dist', 'app', 'settings-session.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');

async function loadDrawerModules() {
  await ensureDistBuilt();

  return {
    drawer: await import(pathToFileURL(DRAWER_PATH).href),
    settings: await import(pathToFileURL(SESSION_PATH).href),
    themes: await import(pathToFileURL(THEMES_PATH).href),
  };
}

function surfaceText(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')
  )).join('\n');
}

test('settings drawer renders structured rows and highlights the selected row', async () => {
  const { drawer, settings, themes } = await loadDrawerModules();
  const theme = themes.availableJeditThemes()[0];
  const rows = settings.jeditSettingsRows({
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
  });

  const surface = drawer.renderSettingsDrawer({
    rows,
    selectedIndex: 1,
    theme,
    width: 42,
    height: 20,
  });
  const text = surfaceText(surface);

  assert.match(text, /Settings/);
  assert.match(text, /F2\/Esc close/);
  assert.match(text, /● English Current/);
  assert.match(text, /↻ Theme/);
  assert.match(text, /☑ Footer/);
  assert.match(text, /↻ Markdown preview/);
  assert.match(text, /↻ Diagnostics Open/);
  assert.equal(surface.get(2, 8).char, '›');
  assert.equal(surface.get(2, 8).fg, theme.cursor.normal.fg);
  assert.equal(surface.get(2, 8).bg, theme.cursor.normal.bg);
});

test('settings drawer keeps the focused row visible when section headers consume short drawers', async () => {
  const { drawer, settings, themes } = await loadDrawerModules();
  const theme = themes.availableJeditThemes()[0];
  const rows = settings.jeditSettingsRows({
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
  });
  const selectedIndex = rows.findIndex((row) => row.id === 'markdown-preview');

  const surface = drawer.renderSettingsDrawer({
    rows,
    selectedIndex,
    theme,
    width: 42,
    height: 12,
  });

  assert.match(surfaceText(surface), /› ↻ Markdown preview Source/);
});
