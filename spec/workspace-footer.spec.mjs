import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { visibleLength } from '@flyingrobots/bijou-tui';
import { createI18nMock } from './i18n-mock.mjs';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'workspace-chrome.js');
const POSTURE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'workspace-footer-posture-line.js');

async function loadFooterModule() {
  await ensureDistBuilt();

  return import(pathToFileURL(MODULE_PATH).href);
}

async function loadFooterPostureModule() {
  await ensureDistBuilt();

  return import(pathToFileURL(POSTURE_MODULE_PATH).href);
}

function idleNormalState() {
  return {
    i18n: createI18nMock(),
    focusPane: 'editor',
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    viewMode: 'source',
    markdownPreviewActive: true,
    settingsOpen: false,
    editorMode: 'normal',
    pendingNormal: undefined,
    cwd: '/repo',
    selectedEntry: undefined,
    editorPath: '/repo/notes/todo.md',
    graftPath: undefined,
    graftSelection: undefined,
  };
}

test('workspace footer shows compact uppercase normal-mode guidance', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines(idleNormalState()),
    [
      'NORMAL [i insert · o open line · f3 preview · ctrl+t theme]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer can surface the last command provenance summary', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      commandSummary: 'last: dw delete motion 0..6 receipt receipt:dw',
    }),
    [
      'NORMAL [last: dw delete motion 0..6 receipt receipt:dw · i insert · o open line · f3 preview · ctrl+t theme]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer shows editor cursor position when available', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      editorCursorPosition: {
        line: 6,
        col: 1,
      },
    }),
    [
      'NORMAL 6:1 [i insert · o open line · f3 preview · ctrl+t theme]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer renders active command-line input like Vim', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      commandLine: {
        active: true,
        input: 'edit src/app',
        cursorIndex: 12,
        selectedCompletionIndex: 0,
      },
    }),
    [
      ':edit src/app',
      '[tab accept · enter run · esc cancel]',
    ],
  );
});

test('workspace footer obtains command-line hints from i18n', async () => {
  const footer = await loadFooterModule();
  const requestedKeys = [];
  const i18n = {
    locale: 'en',
    direction: 'ltr',
    t: (path) => {
      requestedKeys.push(path);
      if (path === 'footer.command.hints.tab_accept') return 'tab choose';
      if (path === 'footer.command.hints.enter_run') return 'enter run';
      if (path === 'footer.command.hints.esc_cancel') return 'esc close';
      if (path.startsWith('footer.mode.')) return path.slice('footer.mode.'.length);
      return path;
    },
    setLocale: () => undefined,
  };

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      i18n,
      commandLine: {
        active: true,
        input: 'w',
        cursorIndex: 1,
        selectedCompletionIndex: 0,
      },
    }),
    [
      ':w',
      '[tab choose · enter run · esc close]',
    ],
  );
  assert.equal(requestedKeys.includes('footer.command.hints.tab_accept'), true);
  assert.equal(requestedKeys.includes('footer.command.hints.enter_run'), true);
  assert.equal(requestedKeys.includes('footer.command.hints.esc_cancel'), true);
});

test('workspace footer renders command-line hints on the painted secondary row', async () => {
  const footer = await loadFooterModule();
  const surface = footer.renderWorkspaceFooter({
    ...idleNormalState(),
    commandLine: {
      active: true,
      input: 'e',
      cursorIndex: 1,
      selectedCompletionIndex: 0,
    },
  }, 44, {});

  assert.equal(rowText(surface, 1).trim(), '[tab accept · enter run · esc cancel]');
});

test('workspace footer applies theme foreground and background to painted text', async () => {
  const footer = await loadFooterModule();
  const token = {
    fg: '#22272e',
    fgRGB: [34, 39, 46],
    bg: '#dedad0',
    bgRGB: [222, 218, 208],
    foregroundVariables: [],
    backgroundVariables: [],
  };
  const surface = footer.renderWorkspaceFooter(idleNormalState(), 24, token);
  const cell = surface.get(0, 0);

  assert.equal(cell.char, 'N');
  assert.deepEqual(cell.fgRGB, token.fgRGB);
  assert.deepEqual(cell.bgRGB, token.bgRGB);
});

test('workspace footer pins editor posture to the lower-right corner when it fits', async () => {
  const footer = await loadFooterModule();
  const posture = 'basis:reading | head:basis | worldline:main | export:host | admit:main | tick:t0';
  const surface = footer.renderWorkspaceFooter({
    ...idleNormalState(),
    textPosture: posture,
  }, 132, {});
  const secondary = rowText(surface, 1);

  assert.equal(secondary.startsWith('/repo/notes/todo.md'), true);
  assert.equal(secondary.endsWith(`[${posture}]`), true);
  assert.equal(secondary.includes(`/repo/notes/todo.md [${posture}]`), false);
});

test('workspace footer posture fit uses terminal display width for wide glyphs', async () => {
  const footerPosture = await loadFooterPostureModule();
  const editorPath = '/repo/界.md';
  const textPosture = 'basis:reading | head:local';
  const requiredWidth = visibleLength(`${editorPath} [${textPosture}]`);

  assert.equal(requiredWidth, 40);
  assert.equal(footerPosture.editorFooterPostureFits(editorPath, textPosture, requiredWidth - 1), false);
  assert.equal(footerPosture.editorFooterPostureFits(editorPath, textPosture, requiredWidth), true);
});

test('workspace footer shows pending change-operator continuations', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      pendingNormal: 'c',
    }),
    [
      'NORMAL c [cc line · cw word · ce word-end · c0 start · c$ end]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer explains that tab indents when no peer panes are visible in insert mode', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      editorMode: 'insert',
    }),
    [
      'INSERT [text input · esc normal · ctrl+s save · ctrl+t theme · tab indent]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer shows f3 as the Markdown preview source toggle', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      viewMode: 'preview',
    }),
    [
      'PREVIEW [j/k scroll · f3 source · ctrl+t theme · ctrl+b files · ctrl+g graft · ctrl+h history]',
      '/repo/notes/todo.md',
    ],
  );
});

test('workspace footer shows file drawer controls and the selected file path', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      i18n: createI18nMock(),
      focusPane: 'files',
      fileDrawerOpen: true,
      graftDrawerOpen: false,
      historyDrawerOpen: false,
      viewMode: 'source',
      markdownPreviewActive: false,
      settingsOpen: false,
      editorMode: 'normal',
      pendingNormal: undefined,
      cwd: '/repo',
      selectedEntry: {
        kind: 'file',
        name: 'very-long-file-name.md',
        path: '/repo/notes/very-long-file-name.md',
      },
      editorPath: '/repo/notes/todo.md',
      graftPath: undefined,
      graftSelection: undefined,
    }),
    [
      'FILES [j/k move · enter open · backspace up · ctrl+b close · ctrl+t theme · tab focus]',
      '/repo/notes/very-long-file-name.md',
    ],
  );
});

test('workspace footer shows history drawer controls and evidence count', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      focusPane: 'history',
      historyDrawerOpen: true,
      echoHistoryCount: 3,
    }),
    [
      'HISTORY [j/k move · ctrl+h close · esc close · ctrl+t theme · tab focus]',
      'Echo evidence: 3',
    ],
  );
});

test('workspace footer shows settings drawer controls while settings are open', async () => {
  const footer = await loadFooterModule();

  assert.deepEqual(
    footer.workspaceFooterLines({
      ...idleNormalState(),
      settingsOpen: true,
      editorCursorPosition: {
        line: 9,
        col: 1,
      },
    }),
    [
      'SETTINGS [j/k move · enter change · f2 close · esc close]',
      'settings',
    ],
  );
});

test('workspace footer obtains the scene picker hint label from i18n', async () => {
  const footer = await loadFooterModule();
  const requestedKeys = [];
  const i18n = {
    locale: 'en',
    direction: 'ltr',
    t: (path) => {
      requestedKeys.push(path);
      if (path === 'footer.mode.browse') {
        return 'browse';
      }
      if (path === 'footer.hints.ctrl_l_scene_picker') {
        return 'ctrl+l scene picker';
      }
      if (path === 'footer.hints.ctrl_t_theme') {
        return 'ctrl+t theme';
      }
      if (path === 'footer.hints.ctrl_b_files') {
        return 'ctrl+b files';
      }
      if (path === 'footer.hints.ctrl_g_graft') {
        return 'ctrl+g graft';
      }
      if (path === 'footer.hints.ctrl_h_history') {
        return 'ctrl+h history';
      }
      const parts = path.split('.');
      return parts[parts.length - 1].replace(/_/g, ' ');
    },
    setLocale: () => undefined,
  };

  assert.deepEqual(
    footer.workspaceFooterLines({
      i18n,
      focusPane: 'editor',
      fileDrawerOpen: false,
      graftDrawerOpen: false,
      historyDrawerOpen: false,
      viewMode: 'source',
      markdownPreviewActive: false,
      settingsOpen: false,
      editorMode: undefined,
      pendingNormal: undefined,
      cwd: '/repo',
      selectedEntry: undefined,
      editorPath: undefined,
      graftPath: undefined,
      graftSelection: undefined,
    }),
    [
      'BROWSE [ctrl+l scene picker · ctrl+t theme · ctrl+b files · ctrl+g graft · ctrl+h history]',
      '/repo',
    ],
  );
  assert.equal(requestedKeys.includes('footer.hints.ctrl_l_scene_picker'), true);
});

test('workspace footer obtains command hints from i18n', async () => {
  const footer = await loadFooterModule();
  const requestedKeys = [];
  const i18n = {
    locale: 'en',
    direction: 'ltr',
	    t: (path, values) => {
	      requestedKeys.push(path);
	      if (path.startsWith('footer.mode.')) {
	        return path.slice('footer.mode.'.length);
	      }
	      if (path === 'footer.context.history_count') {
	        return `<${path}:${values?.count}>`;
	      }
	      return `<${path}>`;
	    },
    setLocale: () => undefined,
  };

  const [primary] = footer.workspaceFooterLines({
    i18n,
    focusPane: 'files',
    fileDrawerOpen: true,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    viewMode: 'source',
    markdownPreviewActive: false,
    settingsOpen: false,
    editorMode: 'normal',
    pendingNormal: undefined,
    cwd: '/repo',
    selectedEntry: {
      kind: 'file',
      name: 'todo.md',
      path: '/repo/todo.md',
    },
    editorPath: '/repo/todo.md',
    graftPath: undefined,
    graftSelection: undefined,
  });

  assert.equal(primary.includes('<footer.hints.enter_open>'), true);
  assert.equal(primary.includes('<footer.hints.backspace_up>'), true);
  assert.equal(primary.includes('<footer.hints.ctrl_b_close>'), true);
  assert.equal(requestedKeys.includes('footer.hints.enter_open'), true);
  assert.equal(requestedKeys.includes('footer.hints.ctrl_b_close'), true);
});

test('workspace footer right-aligns RTL footer text by visual content width', async () => {
  const footer = await loadFooterModule();
  const i18n = {
    locale: 'me',
    direction: 'rtl',
    t: (path) => {
      if (path === 'footer.mode.insert') return 'insert';
      if (path === 'footer.hints.text_input') return 'text';
      if (path === 'footer.hints.esc_normal') return 'esc';
      if (path === 'footer.hints.ctrl_s_save') return 'save';
      if (path === 'footer.hints.tab_indent') return 'tab';
      return '';
    },
    setLocale: () => undefined,
  };
  const surface = footer.renderWorkspaceFooter({
    ...idleNormalState(),
    i18n,
    editorMode: 'insert',
    markdownPreviewActive: false,
  }, 60, {});
  let primary = '';
  for (let col = 0; col < surface.width; col += 1) {
    primary += surface.get(col, 0).char;
  }

  assert.equal(primary.startsWith(' '), true);
  assert.equal(primary.trimStart().startsWith('INSERT'), true);
  assert.equal(primary.endsWith(']'), true);
});

test('workspace footer obtains context labels from i18n', async () => {
  const footer = await loadFooterModule();
  const requestedKeys = [];
	  const i18n = {
	    locale: 'en',
	    direction: 'ltr',
	    t: (path, values) => {
	      requestedKeys.push(path);
	      if (path === 'footer.context.history_count') {
	        return `<${path}:${values?.count}>`;
	      }
	      if (path.startsWith('footer.mode.')) {
	        return path.slice('footer.mode.'.length);
	      }
	      return `<${path}>`;
	    },
    setLocale: () => undefined,
  };
  const base = {
    i18n,
    focusPane: 'editor',
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    viewMode: 'source',
    markdownPreviewActive: false,
    settingsOpen: false,
    editorMode: undefined,
    pendingNormal: undefined,
    cwd: '/repo',
    selectedEntry: undefined,
    editorPath: undefined,
    graftPath: undefined,
    graftSelection: undefined,
  };

  assert.equal(footer.workspaceFooterLines({ ...base, settingsOpen: true })[1], '<footer.context.settings>');
  assert.equal(footer.workspaceFooterLines({
    ...base,
    focusPane: 'graft',
    graftDrawerOpen: true,
  })[1], '<footer.context.graft_empty>');
  assert.equal(footer.workspaceFooterLines({
    ...base,
    focusPane: 'history',
    historyDrawerOpen: true,
  })[1], '<footer.context.history_empty>');
  assert.equal(footer.workspaceFooterLines({
    ...base,
    focusPane: 'history',
    historyDrawerOpen: true,
    echoHistoryCount: 2,
  })[1], '<footer.context.history_count:2>');
  assert.equal(requestedKeys.includes('footer.context.settings'), true);
  assert.equal(requestedKeys.includes('footer.context.graft_empty'), true);
  assert.equal(requestedKeys.includes('footer.context.history_empty'), true);
  assert.equal(requestedKeys.includes('footer.context.history_count'), true);
});

function rowText(surface, row) {
  let text = '';
  for (let col = 0; col < surface.width; col += 1) {
    text += surface.get(col, row).char;
  }
  return text;
}
