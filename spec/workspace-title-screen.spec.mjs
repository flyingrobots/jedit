import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasNotification,
  importDist,
  mockDeps,
  mockTitleScreenModel,
  notification,
  noopNotificationTickCmd,
} from './workspace-helpers.mjs';

test('title screen number keys switch render modes without an editor', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const [asciiModel] = keyBindings.updateFromKey(
    { key: '2' },
    mockTitleScreenModel(titleScreen, { titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );
  const [brailleModel] = keyBindings.updateFromKey(
    { key: '1' },
    mockTitleScreenModel(titleScreen, { titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );

  assert.equal(asciiModel.titleRenderMode, titleScreen.TITLE_RENDER_MODE.Ascii);
  assert.equal(brailleModel.titleRenderMode, titleScreen.TITLE_RENDER_MODE.Braille);
  assert.equal(hasNotification(asciiModel, 'Title shader', 'ASCII · Dense'), true);
  assert.equal(hasNotification(brailleModel, 'Title shader', 'Braille'), true);
  assert.equal(notification(asciiModel, 'Title shader', 'ASCII · Dense').placement, 'LOWER_RIGHT');
  assert.deepEqual(notification(asciiModel, 'Title shader', 'ASCII · Dense').bgToken, {
    hex: '#f0f6fc',
    bg: '#0d1117',
  });
  assert.deepEqual(notification(asciiModel, 'Title shader', 'ASCII · Dense').accentToken, {
    hex: '#58a6ff',
    bg: '#0d1117',
  });
});

test('period cycles title screen ASCII palettes only when ASCII mode is active without an editor', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const [ignoredModel, ignoredCommands] = keyBindings.updateFromKey(
    { key: '.' },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
      titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );
  const [firstModel] = keyBindings.updateFromKey(
    { key: '.' },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii,
      titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );
  const [secondModel] = keyBindings.updateFromKey(
    { key: '.' },
    firstModel,
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );

  assert.equal(ignoredModel.titleRenderMode, titleScreen.TITLE_RENDER_MODE.Braille);
  assert.equal(ignoredModel.titleAsciiPalette, titleScreen.TITLE_ASCII_PALETTE.Dense);
  assert.equal(ignoredModel.notifications.items.length, 0);
  assert.equal(ignoredCommands.length, 0);
  assert.equal(firstModel.titleRenderMode, titleScreen.TITLE_RENDER_MODE.Ascii);
  assert.equal(firstModel.titleAsciiPalette, titleScreen.TITLE_ASCII_PALETTE.Minimal);
  assert.equal(secondModel.titleAsciiPalette, titleScreen.TITLE_ASCII_PALETTE.Technical);
  assert.equal(hasNotification(firstModel, 'ASCII palette', 'Minimal'), true);
  assert.equal(hasNotification(secondModel, 'ASCII palette', 'Technical'), true);
  assert.equal(notification(firstModel, 'ASCII palette', 'Minimal').placement, 'LOWER_RIGHT');
});
