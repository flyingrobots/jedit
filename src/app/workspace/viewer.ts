import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { compositeFeedback } from '../../ui/feedback.js';
import {
  activeWorkspaceTitle,
  centerLine,
  renderWorkspaceFooter,
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
import { isWorkspaceMarkdownPreviewAvailable, renderViewer } from './viewer-content.js';
import { renderDrawer } from './viewer-drawers.js';
import { fillSurface } from './surface-fill.js';
import { renderSmallTerminalNotice } from './small-terminal-view.js';
import { paintWorkspaceOverlays, workspaceFeedbackOverlay } from './viewer-overlays.js';
import { workspaceTextAuthorityPosture } from './workspace-text-authority.js';

const WORKSPACE_BODY_TOP_OFFSET = 2;

export { updateViewerFromKey } from './viewer-key.js';

export function renderWorkspace(model: WorkspaceModel): Surface {
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
  screen.blit(renderViewer(model, layout.viewer.width, bodyHeight), layout.viewer.x, bodyTop);
  paintWorkspaceDrawers(screen, model, layout, bodyTop, bodyHeight);
  paintWorkspaceFocusEdge(screen, model, layout, bodyTop, bodyHeight);
  paintWorkspaceFooter(screen, model);
  paintWorkspaceOverlays(screen, model, bodyTop, bodyHeight);

  return renderFeedback(screen, model);
}

function paintWorkspaceTitle(screen: Surface, model: WorkspaceModel): void {
  screen.blit(
    stringToSurface(centerLine(activeWorkspaceTitle({
      cwd: model.cwd,
      editorPath: model.editor?.path,
      editorDirty: model.editor?.dirty ?? false,
      selectedEntry: model.entries[model.selectedIndex],
    }), model.columns), model.columns, 1),
    0,
    0,
  );
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
        pendingNormal: model.editor?.pendingNormal,
        settingsOpen: model.settingsOpen,
        cwd: model.cwd,
        selectedEntry: model.entries[model.selectedIndex],
        editorPath: model.editor?.path,
        textPosture: workspaceTextAuthorityPosture(model.textAuthority),
        echoHistoryCount: model.echoHistory.length,
        graftPath: model.graftInfo?.path,
        graftSelection: selectedGraftSelection(model),
      }, model.columns, model.jeditTheme.surface.footer),
      0,
      model.rows - FOOTER_ROWS,
    );
  }
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

function renderFeedback(screen: Surface, model: WorkspaceModel): Surface {
  return compositeFeedback(screen, model.notifications, model.columns, model.rows, workspaceFeedbackOverlay(model));
}
