import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import type { Cmd, KeyMsg, NotificationState } from '@flyingrobots/bijou-tui';
import { compositeFeedback } from '../../ui/feedback.js';
import {
  activeWorkspaceTitle,
  centerLine,
  renderWorkspaceFooter,
} from '../../ui/workspace-chrome.js';
import {
  fitBlock,
  formatTreeLine,
} from '../../ui/workspace-render.js';
import { renderGraftDrawerLines } from '../../ui/graft-drawer.js';
import { renderSourceViewer } from '../../ui/source-viewer.js';
import { paintActivePaneEdge } from '../../ui/workspace-focus-edge.js';
import { paintMarkdownPreview } from '../../ui/markdown-preview.js';
import { resolveScenePickerDrawerWidth, renderScenePickerDrawer } from '../../ui/scene-picker-drawer.js';
import { resolveSettingsDrawerWidth, renderSettingsDrawer } from '../../ui/settings-drawer.js';
import { renderTitleScreen } from '../../ui/title-screen.js';
import { resolveWorkspaceLayout, type DrawerKind } from '../../ui/drawer-layout.js';
import { hasFocusablePeers } from '../../ui/panel-focus.js';
import {
  editorViewport,
  MIN_COLUMNS,
  MIN_ROWS,
  workspaceBodyHeight,
  DRAWER_INNER_PAD,
  VIEWER_LEFT_PAD,
  VIEWER_TOP_PAD,
} from './viewport.js';
import {
  isWorkspaceMarkdownFile,
  scrollPreview,
  updateInsertMode,
  updateNormalMode,
} from './editor-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import {
  beginSourceHighlightRefresh,
  shouldRefreshSourceHighlight,
} from '../source-highlight-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { settingsRows } from './settings.js';
import { focusCycleState } from './focus.js';
import type { JeditStyleToken, JeditTheme } from '../../ui/jedit-theme.js';

export function updateViewerFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null) {
    return [model, []];
  }

  const viewport = editorViewport(model);
  if (model.viewMode === 'preview') {
    return [{
      ...model,
      editor: scrollPreview(model.editor, msg, viewport.height),
    }, []];
  }

  const canTabIndent = !hasFocusablePeers(focusCycleState(model));
  const editor = model.editor.mode === 'insert'
    ? updateInsertMode(model.editor, msg, viewport.width, viewport.height, canTabIndent)
    : updateNormalMode(model.editor, msg, viewport.width, viewport.height);

  const next: WorkspaceModel = {
    ...model,
    editor,
  };

  return shouldRefreshSourceHighlight(model.editor, editor)
    ? beginSourceHighlightRefresh(next, editor, viewport, sourceHighlighter)
    : [next, []];
}

export function renderWorkspace(model: WorkspaceModel): Surface {
  const screen = createSurface(model.columns, model.rows);
  fillSurface(screen, model.jeditTheme.surface.workspace);

  if (model.columns < MIN_COLUMNS || model.rows < MIN_ROWS) {
    const message = [
      '',
      'jedit',
      '',
      `need at least ${MIN_COLUMNS} columns x ${MIN_ROWS} rows`,
      `current terminal: ${model.columns} x ${model.rows}`,
    ].join('\n');
    screen.blit(stringToSurface(fitBlock(message, model.columns, model.rows), model.columns, model.rows), 0, 0);
    return renderFeedback(screen, model.notifications, model.columns, model.rows);
  }

  const bodyTop = 2;
  const bodyHeight = workspaceBodyHeight(model.rows, model.footerVisible);
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress);

  screen.blit(
    stringToSurface(
      centerLine(activeWorkspaceTitle({
        cwd: model.cwd,
        editorPath: model.editor?.path,
        editorDirty: model.editor?.dirty ?? false,
        selectedEntry: model.entries[model.selectedIndex],
      }), model.columns),
      model.columns,
      1,
    ),
    0,
    0,
  );
  screen.blit(renderViewer(model, layout.viewer.width, bodyHeight), layout.viewer.x, bodyTop);

  if (layout.fileDrawer.width > 0) {
    screen.blit(renderDrawer('files', model, layout.fileDrawer.width, bodyHeight), layout.fileDrawer.x, bodyTop);
  }
  if (layout.graftDrawer.width > 0) {
    screen.blit(renderDrawer('graft', model, layout.graftDrawer.width, bodyHeight), layout.graftDrawer.x, bodyTop);
  }

  paintActivePaneEdge(screen, layout, {
    focusPane: model.focusPane,
    fileDrawerOpen: model.fileDrawerOpen,
    graftDrawerOpen: model.graftDrawerOpen,
    hasEditor: model.editor != null,
  }, model.jeditTheme.chrome.activeEdge, {
    top: bodyTop,
    height: bodyHeight,
  });

  if (model.footerVisible) {
    screen.blit(
      renderWorkspaceFooter({
        i18n: model.i18n,
        focusPane: model.focusPane,
        fileDrawerOpen: model.fileDrawerOpen,
        graftDrawerOpen: model.graftDrawerOpen,
        viewMode: model.viewMode,
        markdownPreviewActive: model.editor != null && isWorkspaceMarkdownFile(model.editor.path),
        editorMode: model.editor?.mode,
        pendingNormal: model.editor?.pendingNormal,
        settingsOpen: model.settingsOpen,
        cwd: model.cwd,
        selectedEntry: model.entries[model.selectedIndex],
        editorPath: model.editor?.path,
        graftPath: model.graftInfo?.path,
        graftSelection: selectedGraftSelection(model),
      }, model.columns, model.jeditTheme.surface.footer),
      0,
      model.rows - 2,
    );
  }

  if (model.settingsOpen) {
    screen.blit(
      renderSettingsDrawer({
        rows: settingsRows(model),
        selectedIndex: model.settingsFocusIndex,
        theme: model.jeditTheme,
        width: resolveSettingsDrawerWidth(model.columns),
        height: bodyHeight,
      }),
      0,
      bodyTop,
    );
  }

  if (model.scenePickerOpen && model.editor == null) {
    screen.blit(
      renderScenePickerDrawer({
        scenes: model.availableScenes,
        selectedIndex: model.scenePickerFocusIndex,
        theme: model.jeditTheme,
        width: resolveScenePickerDrawerWidth(model.columns),
        height: bodyHeight,
      }),
      0,
      bodyTop,
    );
  }

  return renderFeedback(screen, model.notifications, model.columns, model.rows);
}

function renderViewer(model: WorkspaceModel, width: number, height: number): Surface {
  if (model.editor == null) {
    return renderTitleScreen(width, height, model.time, model.jeditTheme, {
      camAngle: model.titleCamera.angle,
      camRadius: model.titleCamera.radius,
      sceneSeed: model.titleSceneSeed,
      mesh: model.titleMeshes.bunny,
      sceneOverride: model.sceneOverride,
      renderMode: model.titleRenderMode,
      asciiPalette: model.titleAsciiPalette,
    });
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.workspace);

  if (model.viewMode === 'preview' && isWorkspaceMarkdownFile(model.editor.path)) {
    return renderPreview(surface, model.editor, model.jeditTheme, width, height);
  }

  const viewport = viewerViewport(width, height);
  return renderSourceViewer(surface, model.editor, model.sourceHighlight?.path === model.editor.path ? model.sourceHighlight : undefined, {
    viewport,
    leftPad: VIEWER_LEFT_PAD,
    topPad: VIEWER_TOP_PAD,
    theme: model.jeditTheme,
  });
}

function renderPreview(surface: Surface, editor: WorkspaceModel['editor'], theme: JeditTheme, width: number, height: number): Surface {
  const viewport = viewerViewport(width, height);
  paintMarkdownPreview(surface, editor?.lines.join('\n') ?? '', editor?.scrollRow ?? 0, VIEWER_LEFT_PAD, VIEWER_TOP_PAD, viewport.width, viewport.height, theme);
  return surface;
}

function viewerViewport(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(1, width - (VIEWER_LEFT_PAD * 2)),
    height: Math.max(1, height - (VIEWER_TOP_PAD * 2)),
  };
}

function renderDrawer(kind: DrawerKind, model: WorkspaceModel, width: number, height: number): Surface {
  if (kind === 'graft') {
    return renderGraftDrawer(model, width, height);
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);

  const listWidth = Math.max(1, width - (DRAWER_INNER_PAD * 2));
  const listHeight = Math.max(1, height - (DRAWER_INNER_PAD * 2));
  const lines = model.entries.map((entry, index) => formatTreeLine(entry, index === model.selectedIndex));
  const content = stringToSurface(fitBlock(lines.join('\n'), listWidth, listHeight), listWidth, listHeight);
  applyBackground(content, model.jeditTheme.surface.drawer);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);

  return surface;
}

function renderGraftDrawer(model: WorkspaceModel, width: number, height: number): Surface {
  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);

  const innerWidth = Math.max(1, width - (DRAWER_INNER_PAD * 2));
  const innerHeight = Math.max(1, height - (DRAWER_INNER_PAD * 2));
  const lines = renderGraftDrawerLines(model, innerWidth, innerHeight);
  const content = stringToSurface(fitBlock(lines.join('\n'), innerWidth, innerHeight), innerWidth, innerHeight);
  applyBackground(content, model.jeditTheme.surface.drawer);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);

  return surface;
}

function selectedGraftSelection(model: WorkspaceModel): { kind: string; name: string; startLine: number } | undefined {
  const selected = model.graftInfo?.outlineItems[model.graftSelectedIndex];
  if (selected == null) {
    return undefined;
  }
  return {
    kind: selected.kind,
    name: selected.name,
    startLine: selected.startLine,
  };
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: ' ',
    fg: token.fg,
    fgRGB: token.fgRGB,
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyBackground(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        char: cell.char.length > 0 ? cell.char : ' ',
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
}

function renderFeedback(screen: Surface, notifications: NotificationState<WorkspaceMsg>, columns: number, rows: number): Surface {
  return compositeFeedback(screen, notifications, columns, rows);
}
