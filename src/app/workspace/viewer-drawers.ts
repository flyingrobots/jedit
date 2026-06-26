import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { DrawerKinds, type DrawerKind } from '../../ui/drawer-layout.js';
import { renderGraftDrawerLines } from '../../ui/graft-drawer.js';
import {
  fitBlock,
  formatTreeLine,
} from '../../ui/workspace-render.js';
import type { WorkspaceModel } from './model.js';
import { DRAWER_INNER_PAD } from './viewport.js';
import { applyBackground, fillSurface } from './surface-fill.js';
import { renderEchoHistoryLines } from './echo-history.js';
import { renderWorkspaceWorldlinePhaseLines } from './worldline-phase-view.js';
import {
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';

const MIN_VIEWPORT_DIMENSION = 1;
const DRAWER_PAD_MULTIPLIER = 2;

export function renderDrawer(kind: DrawerKind, model: WorkspaceModel, width: number, height: number): Surface {
  if (kind === DrawerKinds.Graft) {
    return renderGraftDrawer(model, width, height);
  }
  if (kind === DrawerKinds.History) {
    return renderHistoryDrawer(model, width, height);
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);

  const listWidth = Math.max(MIN_VIEWPORT_DIMENSION, width - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER));
  const listHeight = Math.max(MIN_VIEWPORT_DIMENSION, height - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER));
  const lines = model.entries.map((entry, index) => formatTreeLine(entry, {
    selected: index === model.selectedIndex,
  }));
  const content = stringToSurface(fitBlock(lines.join('\n'), listWidth, listHeight), listWidth, listHeight);
  applyBackground(content, model.jeditTheme.surface.drawer);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);

  return surface;
}

function renderHistoryDrawer(model: WorkspaceModel, width: number, height: number): Surface {
  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);

  const innerWidth = Math.max(MIN_VIEWPORT_DIMENSION, width - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER));
  const innerHeight = Math.max(MIN_VIEWPORT_DIMENSION, height - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER));
  const lines = model.historyDrawerView === WorkspaceHistoryDrawerViews.Worldlines
    ? renderWorkspaceWorldlinePhaseLines(model, innerWidth, innerHeight, model.i18n)
    : renderEchoHistoryLines(
      model.echoHistory,
      model.echoHistorySelectedIndex,
      innerWidth,
      innerHeight,
      model.i18n,
    );
  const content = stringToSurface(fitBlock(lines.join('\n'), innerWidth, innerHeight), innerWidth, innerHeight);
  applyBackground(content, model.jeditTheme.surface.drawer);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);

  return surface;
}

function renderGraftDrawer(model: WorkspaceModel, width: number, height: number): Surface {
  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);

  const innerWidth = Math.max(MIN_VIEWPORT_DIMENSION, width - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER));
  const innerHeight = Math.max(MIN_VIEWPORT_DIMENSION, height - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER));
  const lines = renderGraftDrawerLines(model, innerWidth, innerHeight);
  const content = stringToSurface(fitBlock(lines.join('\n'), innerWidth, innerHeight), innerWidth, innerHeight);
  applyBackground(content, model.jeditTheme.surface.drawer);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);

  return surface;
}
