import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { compositeFeedback } from '../../ui/feedback.js';
import {
  activeWorkspaceTitle,
  centerLine,
  renderWorkspaceFooter,
  type WorkspaceFooterCursorPosition,
} from '../../ui/workspace-chrome.js';
import { paintActivePaneEdge } from '../../ui/workspace-focus-edge.js';
import { DrawerKinds, resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import {
  MIN_COLUMNS,
  MIN_ROWS,
  workspaceBodyHeight,
  FOOTER_ROWS,
} from './viewport.js';
import type { WorkspaceModel } from './model.js';
import {
  createViewerContentRenderer,
  isWorkspaceMarkdownPreviewAvailable,
  type ViewerContentRenderer,
} from './viewer-content.js';
import { renderDrawer } from './viewer-drawers.js';
import { fillSurface } from './surface-fill.js';
import { renderSmallTerminalNotice } from './small-terminal-view.js';
import { paintWorkspaceOverlays, workspaceFeedbackOverlay } from './viewer-overlays.js';
import {
  workspaceFooterCommandSummary,
  workspaceFooterTextPosture,
  workspaceHistoryContextLine,
} from './workspace-footer-posture.js';
import type { JeditColorStop, JeditStyleToken } from '../../ui/jedit-theme.js';

const WORKSPACE_BODY_TOP_OFFSET = 2;
const COMMAND_LINE_WARNING_VARIABLE = 'warning';
const COMMAND_LINE_ERROR_FALLBACK_BACKGROUND = '#6f1d1b';
const COMMAND_LINE_ERROR_FALLBACK_FOREGROUND = '#ffeef0';
const COMMAND_LINE_ERROR_FALLBACK_BACKGROUND_RGB: readonly [number, number, number] = [111, 29, 27];
const CURSOR_POSITION_DISPLAY_OFFSET = 1;

export { updateViewerFromKey } from './viewer-key.js';

export type WorkspaceRenderer = (model: WorkspaceModel) => Surface;

export function createWorkspaceRenderer(): WorkspaceRenderer {
  const viewerContent = createViewerContentRenderer();
  return (model) => renderWorkspaceWithViewer(model, viewerContent);
}

export function renderWorkspace(model: WorkspaceModel): Surface {
  return renderWorkspaceWithViewer(model, createViewerContentRenderer());
}

function renderWorkspaceWithViewer(
  model: WorkspaceModel,
  viewerContent: ViewerContentRenderer,
): Surface {
  const screen = createSurface(model.columns, model.rows);
  fillSurface(screen, model.jeditTheme.surface.workspace);

  if (model.columns < MIN_COLUMNS || model.rows < MIN_ROWS) {
    screen.blit(renderSmallTerminalNotice(model.columns, model.rows), 0, 0);
    return renderFeedback(screen, model);
  }

  const bodyTop = WORKSPACE_BODY_TOP_OFFSET;
  const bodyHeight = workspaceBodyHeight({
    rows: model.rows,
    footerVisible: model.footerVisible,
  });
  const layout = resolveWorkspaceLayout(
    model.columns,
    model.fileDrawerProgress,
    model.graftDrawerProgress,
    model.historyDrawerProgress,
  );

  paintWorkspaceTitle(screen, model);
  screen.blit(viewerContent.renderViewer(model, layout.viewer.width, bodyHeight), layout.viewer.x, bodyTop);
  paintWorkspaceDrawers(screen, model, layout, bodyTop, bodyHeight);
  paintWorkspaceFocusEdge(screen, model, layout, bodyTop, bodyHeight);
  paintWorkspaceFooter(screen, model);
  paintWorkspaceOverlays(screen, model, bodyTop, bodyHeight);

  return renderFeedback(screen, model);
}

function paintWorkspaceTitle(screen: Surface, model: WorkspaceModel): void {
  const title = stringToSurface(centerLine(activeWorkspaceTitle({
    cwd: model.cwd,
    editorPath: model.editor?.path,
    editorDirty: model.editor?.dirty ?? false,
    selectedEntry: model.entries[model.selectedIndex],
  }), model.columns), model.columns, 1);
  applyTitleToken(title, model.jeditTheme.chrome.titleLogo);
  screen.blit(title, 0, 0);
}

function paintWorkspaceDrawers(
  screen: Surface,
  model: WorkspaceModel,
  layout: ReturnType<typeof resolveWorkspaceLayout>,
  bodyTop: number,
  bodyHeight: number,
): void {
  if (layout.fileDrawer.width > 0) {
    screen.blit(renderDrawer(DrawerKinds.Files, model, layout.fileDrawer.width, bodyHeight), layout.fileDrawer.x, bodyTop);
  }
  if (layout.graftDrawer.width > 0) {
    screen.blit(renderDrawer(DrawerKinds.Graft, model, layout.graftDrawer.width, bodyHeight), layout.graftDrawer.x, bodyTop);
  }
  if (layout.historyDrawer.width > 0) {
    screen.blit(renderDrawer(DrawerKinds.History, model, layout.historyDrawer.width, bodyHeight), layout.historyDrawer.x, bodyTop);
  }
}

function paintWorkspaceFocusEdge(
  screen: Surface,
  model: WorkspaceModel,
  layout: ReturnType<typeof resolveWorkspaceLayout>,
  bodyTop: number,
  bodyHeight: number,
): void {
  paintActivePaneEdge(screen, layout, {
    focusPane: model.focusPane,
    fileDrawerOpen: model.fileDrawerOpen,
    graftDrawerOpen: model.graftDrawerOpen,
    historyDrawerOpen: model.historyDrawerOpen,
    hasEditor: model.editor != null,
  }, model.jeditTheme.chrome.activeEdge, {
    top: bodyTop,
    height: bodyHeight,
  });
}

function paintWorkspaceFooter(screen: Surface, model: WorkspaceModel): void {
  if (model.footerVisible) {
    screen.blit(
      renderWorkspaceFooter({
        i18n: model.i18n,
        focusPane: model.focusPane,
        fileDrawerOpen: model.fileDrawerOpen,
        graftDrawerOpen: model.graftDrawerOpen,
        historyDrawerOpen: model.historyDrawerOpen,
        viewMode: model.viewMode,
        markdownPreviewActive: isWorkspaceMarkdownPreviewAvailable(model),
        editorMode: model.editor?.mode,
        editorCursorPosition: workspaceFooterCursorPosition(model),
        pendingNormal: model.editor?.pendingNormal,
        settingsOpen: model.settingsOpen,
        cwd: model.cwd,
        selectedEntry: model.entries[model.selectedIndex],
        editorPath: model.editor?.path,
        textPosture: workspaceFooterTextPosture(model),
        echoHistoryCount: model.echoHistory.length,
        historyContextLine: workspaceHistoryContextLine(model),
        graftPath: model.graftInfo?.path,
        graftSelection: selectedGraftSelection(model),
        commandLine: model.commandLine,
        commandLineError: commandLineErrorToken(model),
        commandSummary: workspaceFooterCommandSummary(model),
      }, model.columns, model.jeditTheme.surface.footer),
      0,
      model.rows - FOOTER_ROWS,
    );
  }
}

function workspaceFooterCursorPosition(
  model: WorkspaceModel,
): WorkspaceFooterCursorPosition | undefined {
  const editor = model.editor;
  return editor == null
    ? undefined
    : {
      line: editor.cursorRow + CURSOR_POSITION_DISPLAY_OFFSET,
      col: editor.cursorCol + CURSOR_POSITION_DISPLAY_OFFSET,
    };
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

function commandLineErrorToken(model: WorkspaceModel): JeditStyleToken {
  const warning = model.jeditTheme.variables.get(COMMAND_LINE_WARNING_VARIABLE);
  return warning == null
    ? fallbackCommandLineErrorToken()
    : warningCommandLineErrorToken(model, warning);
}

function fallbackCommandLineErrorToken(): JeditStyleToken {
  return {
    fg: COMMAND_LINE_ERROR_FALLBACK_FOREGROUND,
    bg: COMMAND_LINE_ERROR_FALLBACK_BACKGROUND,
    bgRGB: COMMAND_LINE_ERROR_FALLBACK_BACKGROUND_RGB,
    foregroundVariables: [],
    backgroundVariables: [],
  };
}

function applyTitleToken(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        fg: token.fg ?? cell.fg,
        fgRGB: token.fgRGB ?? cell.fgRGB,
        bg: token.bg ?? cell.bg,
        bgRGB: token.bgRGB ?? cell.bgRGB,
        modifiers: token.modifiers == null ? cell.modifiers : [...token.modifiers],
        empty: false,
      });
    }
  }
}

function warningCommandLineErrorToken(
  model: WorkspaceModel,
  warning: JeditColorStop,
): JeditStyleToken {
  return {
    ...model.jeditTheme.surface.footer,
    fg:
      model.jeditTheme.surface.workspace.bg ??
      COMMAND_LINE_ERROR_FALLBACK_BACKGROUND,
    bg: warning.hex,
    bgRGB: warning.rgb,
    foregroundVariables: [],
    backgroundVariables: [COMMAND_LINE_WARNING_VARIABLE],
  };
}

function renderFeedback(screen: Surface, model: WorkspaceModel): Surface {
  return compositeFeedback(screen, model.notifications, model.columns, model.rows, workspaceFeedbackOverlay(model));
}
