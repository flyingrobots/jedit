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
    lineNumberMode: 'absolute',
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
  });

  const surface = drawer.renderSettingsDrawer({
    rows,
    selectedIndex: 1,
    theme,
    width: 42,
    height: 26,
  });
  const text = surfaceText(surface);

  assert.match(text, /Settings/);
  assert.match(text, /F2\/Esc\/q close/);
  assert.match(text, /↻ Language < English > 1\/1/);
  assert.match(text, /↻ Theme/);
  assert.match(text, /☑ Footer/);
  assert.match(text, /↻ Line numbers Absolute/);
  assert.match(text, /↻ Markdown preview/);
  assert.match(text, /↻ Diagnostics Open/);
  assert.ok(text.includes('› ↻ Theme'));
  const selectedMarker = surface.get(2, 8);
  assert.equal(selectedMarker.char, '›');
  assert.equal(selectedMarker.fg, theme.cursor.normal.fg);
  assert.equal(selectedMarker.bg, theme.cursor.normal.bg);
});

test('settings drawer keeps the focused row visible when section headers consume short drawers', async () => {
  const { drawer, settings, themes } = await loadDrawerModules();
  const theme = themes.availableJeditThemes()[0];
  const rows = settings.jeditSettingsRows({
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    lineNumberMode: 'absolute',
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

test('settings drawer always returns the requested positive surface size', async () => {
  const { drawer, settings, themes } = await loadDrawerModules();
  const theme = themes.availableJeditThemes()[0];
  const rows = settings.jeditSettingsRows({
    i18n: createI18nMock(),
    jeditTheme: theme,
    footerVisible: true,
    lineNumberMode: 'absolute',
    markdownPreviewActive: true,
    diagnosticsAvailable: true,
    viewMode: 'source',
  });

  for (const [width, height] of [[1, 1], [2, 2], [5, 3], [42, 20]]) {
    const surface = drawer.renderSettingsDrawer({
      rows,
      selectedIndex: 0,
      theme,
      width,
      height,
    });

    assert.equal(surface.width, width);
    assert.equal(surface.height, height);
  }
});
