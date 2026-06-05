import path from 'node:path';
import { createNotificationState } from '@flyingrobots/bijou-tui';
import { REPO_ROOT, ensureDistBuilt, importDist } from './dist-helpers.mjs';

const MOCK_I18N_TRANSLATIONS = Object.freeze({
  'startupFileModal.title': 'Open file',
  'startupFileModal.hint': 'Type filter · Enter open · Esc close',
  'startupFileModal.input_label': 'Filter',
  'startupFileModal.current_directory': 'Current directory',
  'startupFileModal.empty': 'No files in this directory',
  'startupFileModal.no_match': 'No files match',
});

export { REPO_ROOT, ensureDistBuilt, importDist };

export function mockDeps(overrides = {}) {
  return {
    fileSystem: {
      loadEntries: () => [],
      describeDirectoryIssue: () => ({ title: 'test', message: 'not implemented' }),
      dirname: () => '',
      join: (...parts) => parts.join(path.sep),
    },
    editorFile: {
      loadEditorFile: () => ({ lines: [], readOnly: false }),
      saveEditorFile: () => undefined,
    },
    sourceHighlighter: {
      highlight: async () => ({ path: '', partial: false, spans: [] }),
    },
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
      closeConnection: async () => undefined,
    },
    titleSceneLoader: {
      loadTitleSceneFromFile: async () => undefined,
      loadBuiltInTitleScene: async () => undefined,
    },
    productionTextSession: fakeProductionTextSession(),
    wscWorkspaceStore: fakeWscWorkspaceStore(),
    ...overrides,
  };
}

export function fakeProductionTextSession(overrides = {}) {
  return {
    openBuffer: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    insertText: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    replaceRange: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    deleteRange: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    multiRangeEdit: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    checkpointBuffer: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    observeWindow: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    exportWindow: async () => ({ kind: 'obstructed', obstruction: fakeProductionTextObstruction() }),
    ...overrides,
  };
}

export function fakeProductionTextObstruction() {
  return {
    code: 'test-obstruction',
    issue: {
      name: 'TestProductionTextIssue',
      title: 'test production text issue',
      message: 'test production text issue',
      level: 'error',
      source: 'command',
      atMs: 0,
    },
  };
}

export function fakeWscWorkspaceStore() {
  return {
    writeEnvelope: (envelope) => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_WRITTEN',
      envelopeId: envelope.envelopeId,
      byteLength: envelope.bytes.byteLength,
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
    readEnvelope: () => ({ status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED' }),
    listEnvelopes: () => ({ status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED', envelopeIds: [] }),
  };
}

export function mockKeyBindingContext(overrides = {}) {
  const { deps: depsOverride, ...contextOverrides } = overrides;
  return {
    nowMs: () => 0,
    createDrawerAnimationCmd: () => [],
    createStartupFileDrawerAnimationCmd: () => [],
    createNotificationTickCmd: noopNotificationTickCmd,
    deps: mockDeps(depsOverride ?? {}),
    ...contextOverrides,
  };
}

export function mockI18n(overrides = {}) {
  return {
    locale: 'en',
    localeLabel: 'English',
    direction: 'ltr',
    locales: [{
      locale: 'en',
      label: 'English',
      direction: 'ltr',
    }],
    t: (key, values) => applyMockTranslationValues(
      overrides.translations?.[key] ?? MOCK_I18N_TRANSLATIONS[key] ?? '',
      values,
    ),
    setLocale: () => undefined,
    withLocale: (locale) => mockI18n({ ...overrides, locale }),
    ...overrides,
  };
}

function applyMockTranslationValues(template, values) {
  let result = template;
  for (const [key, value] of Object.entries(values ?? {})) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

export function mockRuntime(overrides = {}) {
  return {
    initialColumns: 120,
    initialRows: 24,
    initialWorkingDirectory: '/repo',
    ...mockDeps(),
    profiler: {
      nowMs: () => 0,
      beginTrace: async () => ({ filePath: '/tmp/profile.json', append: async () => undefined, close: async () => undefined }),
      appendTraceFrame: async () => undefined,
      endTrace: async () => undefined,
    },
    createTimeTickCmd: () => () => undefined,
    createNotificationTickCmd: () => () => undefined,
    createDrawerAnimationCmd: () => [],
    createStartupFileDrawerAnimationCmd: () => [],
    initialModel: {
      titleSceneSeed: 0.5,
      jeditTheme: {
        perf: {
          foreground: 'white',
          background: 'black',
        },
      },
      i18n: mockI18n(),
      entries: [],
      nowMs: 0,
    },
    nowMs: () => 0,
    ...overrides,
  };
}

export function noopNotificationTickCmd() {
  return () => undefined;
}

export function mockJeditTheme() {
  return {
    surface: {
      workspace: {
        fg: '#f0f6fc',
        bg: '#0d1117',
      },
    },
    cursor: {
      normal: {
        bg: '#58a6ff',
      },
    },
  };
}

export function mockTitleScreenModel(titleScreen, overrides = {}) {
  return {
    editor: undefined,
    workspaceRoot: '/repo',
    cwd: '/repo',
    entries: [],
    selectedIndex: 0,
    textRuntimeProfile: 'echoHosted',
    textAuthority: {
      kind: 'none',
      profile: 'echoHosted',
    },
    textRequestId: 0,
    viewMode: 'source',
    focusPane: 'editor',
    fileDrawerOpen: false,
    fileDrawerProgress: 0,
    graftDrawerOpen: false,
    graftDrawerProgress: 0,
    historyDrawerOpen: false,
    historyDrawerProgress: 0,
    echoHistory: [],
    echoHistorySelectedIndex: 0,
    settingsOpen: false,
    settingsFocusIndex: 0,
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: [],
    columns: 120,
    rows: 24,
    notifications: createNotificationState(),
    notificationLoopActive: false,
    quitConfirmOpen: false,
    startupIntroComplete: false,
    startupFileModalOpen: false,
    startupFileDrawerProgress: 0,
    startupFileModalInput: '',
    startupFileModalSelectedIndex: 0,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    time: 0,
    titleSceneSeed: 0.5,
    titleMeshes: {},
    titleCamera: {
      angle: 0,
      angleTarget: 0,
      angleMotionId: 0,
      radius: 8.5,
      radiusTarget: 8.5,
      radiusMotionId: 0,
    },
    titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
    titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    ...overrides,
  };
}

export function mockEditor(modeModule, overrides = {}) {
  return {
    path: '/repo/notes.md',
    lines: ['hello world'],
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: modeModule.EditorModes.Normal,
    undoStack: [],
    redoStack: [],
    ...overrides,
  };
}

export function hasNotification(model, title, message) {
  return model.notifications.items.some((item) => item.title === title && item.message === message);
}

export function notification(model, title, message) {
  return model.notifications.items.find((item) => item.title === title && item.message === message);
}

export function surfaceText(surface) {
  const lines = [];
  for (let row = 0; row < surface.height; row += 1) {
    let line = '';
    for (let col = 0; col < surface.width; col += 1) {
      line += surface.get(col, row).char;
    }
    lines.push(line);
  }
  return lines.join('\n');
}
