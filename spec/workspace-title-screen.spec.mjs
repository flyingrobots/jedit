import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasNotification,
  importDist,
  mockDeps,
  mockKeyBindingContext,
  mockTitleScreenModel,
  notification,
  surfaceText,
} from './workspace-helpers.mjs';

test('title screen number keys switch render modes without an editor', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const [asciiModel] = keyBindings.updateFromKey(
    { key: '2' },
    mockTitleScreenModel(titleScreen, { titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille }),
    mockKeyBindingContext(),
  );
  const [brailleModel] = keyBindings.updateFromKey(
    { key: '1' },
    mockTitleScreenModel(titleScreen, { titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii }),
    mockKeyBindingContext(),
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

test('feedback module exposes notification presentation tokens', async () => {
  const feedback = await importDist('ui', 'feedback.js');

  assert.equal(feedback.NotificationVariants.Toast, 'TOAST');
  assert.equal(feedback.NotificationTones.Info, 'INFO');
  assert.equal(feedback.NotificationPlacements.LowerRight, 'LOWER_RIGHT');
});

test('title screen rejects unknown ASCII palettes instead of surfacing them in toast text', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);

  assert.throws(
    () => keyBindings.updateFromKey(
      { key: '2' },
      mockTitleScreenModel(titleScreen, {
        titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
        titleAsciiPalette: 'future-palette',
      }),
      mockKeyBindingContext(),
    ),
    (error) => error?.name === 'InvalidTitleAsciiPaletteError',
  );
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
    mockKeyBindingContext(),
  );
  const [firstModel] = keyBindings.updateFromKey(
    { key: '.' },
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii,
      titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    }),
    mockKeyBindingContext(),
  );
  const [secondModel] = keyBindings.updateFromKey(
    { key: '.' },
    firstModel,
    mockKeyBindingContext(),
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

test('enter and escape skip title intro into the startup file modal', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const base = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });

  const [entered, enterCommands] = keyBindings.updateFromKey(
    { key: 'enter', ctrl: false, alt: false, shift: false },
    base,
    mockKeyBindingContext(),
  );
  const [escaped, escapeCommands] = keyBindings.updateFromKey(
    { key: 'escape', ctrl: false, alt: false, shift: false },
    base,
    mockKeyBindingContext(),
  );

  assert.equal(entered.startupIntroComplete, true);
  assert.equal(entered.startupFileModalOpen, true);
  assert.equal(escaped.startupIntroComplete, true);
  assert.equal(escaped.startupFileModalOpen, true);
  assert.deepEqual(enterCommands, []);
  assert.deepEqual(escapeCommands, []);
});

test('startup intro skip does not interrupt focused file drawer open', async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    fileDrawerOpen: true,
    focusPane: 'files',
    entries: [
      { kind: fileSystem.FileEntryKinds.File, name: 'notes.md', path: '/repo/notes.md' },
    ],
  });

  const [opened, commands] = keyBindings.updateFromKey(
    { key: 'enter', ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ deps: mockDeps() }),
  );

  assert.equal(opened.startupIntroComplete, false);
  assert.equal(opened.startupFileModalOpen, false);
  assert.equal(opened.textAuthority.kind, 'pending-open');
  assert.equal(opened.textAuthority.filePath, '/repo/notes.md');
  assert.equal(commands.length, 1);
});

test('startup file modal renders current directory files over the title screen', async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'viewer.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ui', 'jedit-themes.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    i18n: { direction: 'ltr' },
    cwd: '/repo',
    workspaceRoot: '/repo',
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileModalInput: '',
    startupFileModalSelectedIndex: 0,
    entries: [
      { kind: fileSystem.FileEntryKinds.Directory, name: 'src', path: '/repo/src' },
      { kind: fileSystem.FileEntryKinds.File, name: 'README.md', path: '/repo/README.md' },
    ],
  });
  const text = surfaceText(viewer.renderWorkspace(model));

  assert.match(text, /Open file/);
  assert.match(text, /\/repo/);
  assert.match(text, /src\//);
  assert.match(text, /README\.md/);
});

test('startup file modal input filters current directory rows', async () => {
  const [keyBindings, viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('app', 'workspace', 'viewer.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ui', 'jedit-themes.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    i18n: { direction: 'ltr' },
    cwd: '/repo',
    workspaceRoot: '/repo',
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileModalInput: '',
    startupFileModalSelectedIndex: 0,
    entries: [
      { kind: fileSystem.FileEntryKinds.File, name: 'notes.txt', path: '/repo/notes.txt' },
      { kind: fileSystem.FileEntryKinds.File, name: 'alpha.tmp', path: '/repo/alpha.tmp' },
    ],
  });

  const [filtered] = keyBindings.updateFromKey(
    { key: 'n', ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const text = surfaceText(viewer.renderWorkspace(filtered));

  assert.equal(filtered.startupFileModalInput, 'n');
  assert.match(text, /notes\.txt/);
  assert.doesNotMatch(text, /alpha\.tmp/);
});

test('startup file modal enter opens the selected file through production text authority', async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    cwd: '/repo',
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileModalInput: '',
    startupFileModalSelectedIndex: 0,
    textRequestId: 0,
    textRuntimeProfile: 'echoHosted',
    entries: [
      { kind: fileSystem.FileEntryKinds.File, name: 'notes.md', path: '/repo/notes.md' },
    ],
  });

  const [opened, commands] = keyBindings.updateFromKey(
    { key: 'enter', ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({ deps: mockDeps() }),
  );

  assert.equal(opened.startupFileModalOpen, false);
  assert.equal(opened.textAuthority.kind, 'pending-open');
  assert.equal(opened.textAuthority.filePath, '/repo/notes.md');
  assert.equal(commands.length, 1);
});

test('startup file modal navigation keeps the selected row bounded', async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    startupIntroComplete: true,
    startupFileModalOpen: true,
    entries: [
      { kind: fileSystem.FileEntryKinds.File, name: 'alpha.md', path: '/repo/alpha.md' },
      { kind: fileSystem.FileEntryKinds.File, name: 'beta.md', path: '/repo/beta.md' },
    ],
  });

  const [down] = keyBindings.updateFromKey(
    { key: 'down', ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext(),
  );
  const [pastEnd] = keyBindings.updateFromKey(
    { key: 'j', ctrl: false, alt: false, shift: false },
    down,
    mockKeyBindingContext(),
  );
  const [up] = keyBindings.updateFromKey(
    { key: 'up', ctrl: false, alt: false, shift: false },
    pastEnd,
    mockKeyBindingContext(),
  );

  assert.equal(down.startupFileModalSelectedIndex, 1);
  assert.equal(pastEnd.startupFileModalSelectedIndex, 1);
  assert.equal(up.startupFileModalSelectedIndex, 0);
});

test('startup file modal opens directories without dismissing the modal', async () => {
  const [keyBindings, titleScreen, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const childEntry = { kind: fileSystem.FileEntryKinds.File, name: 'child.md', path: '/repo/src/child.md' };
  const model = mockTitleScreenModel(titleScreen, {
    cwd: '/repo',
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileModalInput: 'src',
    entries: [
      { kind: fileSystem.FileEntryKinds.Directory, name: 'src', path: '/repo/src' },
    ],
  });

  const [opened, commands] = keyBindings.updateFromKey(
    { key: 'enter', ctrl: false, alt: false, shift: false },
    model,
    mockKeyBindingContext({
      deps: mockDeps({
        fileSystem: {
          loadEntries: () => [childEntry],
          describeDirectoryIssue: () => ({ title: 'test', message: 'not implemented' }),
          dirname: () => '/repo',
          join: (...parts) => parts.join('/'),
        },
      }),
    }),
  );

  assert.equal(opened.cwd, '/repo/src');
  assert.deepEqual(opened.entries, [childEntry]);
  assert.equal(opened.startupFileModalOpen, true);
  assert.equal(opened.startupFileModalInput, '');
  assert.deepEqual(commands, []);
});

test('startup file modal renders empty and no-match states', async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'viewer.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ui', 'jedit-themes.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const base = {
    i18n: { direction: 'ltr' },
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
  };
  const emptyText = surfaceText(viewer.renderWorkspace(mockTitleScreenModel(titleScreen, {
    ...base,
    entries: [],
  })));
  const noMatchText = surfaceText(viewer.renderWorkspace(mockTitleScreenModel(titleScreen, {
    ...base,
    startupFileModalInput: 'z',
    entries: [
      { kind: fileSystem.FileEntryKinds.File, name: 'notes.md', path: '/repo/notes.md' },
    ],
  })));

  assert.match(emptyText, /No files in this directory/);
  assert.match(noMatchText, /No files match/);
});

test('startup file modal does not override the small-terminal notice', async () => {
  const [viewer, titleScreen, themes, fileSystem] = await Promise.all([
    importDist('app', 'workspace', 'viewer.js'),
    importDist('ui', 'title-screen.js'),
    importDist('ui', 'jedit-themes.js'),
    importDist('ports', 'file-system.js'),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 40,
    rows: 8,
    i18n: { direction: 'ltr' },
    jeditTheme: themes.availableJeditThemes()[0],
    startupIntroComplete: true,
    startupFileModalOpen: true,
    entries: [
      { kind: fileSystem.FileEntryKinds.File, name: 'notes.md', path: '/repo/notes.md' },
    ],
  });
  const text = surfaceText(viewer.renderWorkspace(model));

  assert.match(text, /need at least/);
  assert.doesNotMatch(text, /Open file/);
});
