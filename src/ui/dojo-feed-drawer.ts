import { createSurface, stringToSurface, wrapToWidth, type Surface, type Cell } from '@flyingrobots/bijou';
import { I18N_TEXT_DIRECTION } from '../ports/i18n.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import { workspaceBodyHeight, WORKSPACE_BODY_TOP_OFFSET } from '../app/workspace/viewport.js';
import { filledSelectionToken } from './filled-selection-token.js';
import { JEDIT_SOURCE_TOKEN, type JeditStyleToken } from './jedit-theme.js';
import { fitLine, visibleLineLength } from './fit-line.js';

export const DOJO_FEED_TITLE = 'Dojo Feed';
export const DOJO_FEED_SOURCE = '127.0.0.1:4747';
const MIN_WIDTH = 32;
const MAX_WIDTH = 48;
const WIDTH_RATIO = 0.42;
const PAD = 2;
const CONTENT_TOP = 6;
const TITLE_ROW = 1;
const CLOSE_ROW = 2;
const STATUS_ROW = 3;
const CONNECTION_ROW = 4;
const SCROLL_HINT_ROW = 5;

export function dojoFeedLayout(model: WorkspaceModel) {
  const width = Math.min(model.columns, MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(model.columns * WIDTH_RATIO)));
  const x = model.columns - width;
  const height = workspaceBodyHeight(model);
  return { x, y: WORKSPACE_BODY_TOP_OFFSET, width, height, closeX: x + PAD, closeY: WORKSPACE_BODY_TOP_OFFSET + CLOSE_ROW,
    closeWidth: width - PAD * 2, contentHeight: Math.max(0, height - CONTENT_TOP), innerWidth: Math.max(1, width - PAD * 2) };
}

export function dojoFeedBodyLines(model: WorkspaceModel): readonly string[] {
  const { innerWidth } = dojoFeedLayout(model);
  return [model.i18n.t('dojoFeed.source'), DOJO_FEED_SOURCE, '', model.i18n.t('dojoFeed.explanation'), '',
    model.i18n.t('dojoFeed.noUpdates')].flatMap((paragraph) => wrapToWidth(paragraph, innerWidth));
}

export function dojoFeedScrollLimit(model: WorkspaceModel): number {
  return Math.max(0, dojoFeedBodyLines(model).length - dojoFeedLayout(model).contentHeight);
}

export function paintDojoFeedDrawer(screen: Surface, model: WorkspaceModel): void {
  if (model.dojoFeedDrawer == null) return;
  const layout = dojoFeedLayout(model);
  const surface = createSurface(layout.width, layout.height);
  const background = model.jeditTheme.surface.drawer;
  surface.fill(styledCell({ char: ' ', empty: false }, background));
  paintBorder(surface, model);
  paintLine(surface, DOJO_FEED_TITLE, TITLE_ROW, filledSelectionToken(model.jeditTheme), model);
  paintLine(surface, model.i18n.t('dojoFeed.close'), CLOSE_ROW, mutedToken(model), model);
  paintLine(surface, model.i18n.t('dojoFeed.waiting'), STATUS_ROW, background, model);
  paintLine(surface, model.i18n.t('dojoFeed.disconnected'), CONNECTION_ROW, mutedToken(model), model);
  if (dojoFeedScrollLimit(model) > 0) paintLine(surface, model.i18n.t('footer.hints.j_k_scroll'), SCROLL_HINT_ROW, mutedToken(model), model);
  paintBody(surface, model);
  screen.blit(surface, layout.x, layout.y);
}

function paintBody(surface: Surface, model: WorkspaceModel): void {
  const layout = dojoFeedLayout(model);
  const offset = Math.min(model.dojoFeedDrawer?.scrollRow ?? 0, dojoFeedScrollLimit(model));
  const lines = dojoFeedBodyLines(model).slice(offset, offset + layout.contentHeight);
  lines.forEach((line, index) => paintLine(surface, line, CONTENT_TOP + index, mutedToken(model), model));
}

function paintLine(surface: Surface, text: string, row: number, token: JeditStyleToken, model: WorkspaceModel): void {
  if (row >= surface.height) return;
  const width = Math.max(1, surface.width - PAD * 2);
  const literal = text === DOJO_FEED_SOURCE || text === DOJO_FEED_TITLE;
  const rtl = !literal && model.i18n.direction === I18N_TEXT_DIRECTION.Rtl;
  const prefix = rtl ? ' '.repeat(Math.max(0, width - visibleLineLength(text))) : '';
  const line = stringToSurface(fitLine(`${prefix}${text}`, width), width, 1);
  for (let x = 0; x < line.width; x += 1) {
    line.set(x, 0, styledCell(line.get(x, 0), token));
  }
  surface.blit(line, PAD, row);
}

function paintBorder(surface: Surface, model: WorkspaceModel): void {
  for (let y = 0; y < surface.height; y += 1) {
    const token = { ...model.jeditTheme.chrome.activeEdge,
      bg: model.jeditTheme.surface.drawer.bg, bgRGB: model.jeditTheme.surface.drawer.bgRGB };
    surface.set(0, y, styledCell({ char: '│', empty: false }, token));
  }
}

function mutedToken(model: WorkspaceModel): JeditStyleToken {
  const comment = model.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Comment);
  return { ...model.jeditTheme.surface.drawer, fg: comment?.fg, fgRGB: comment?.fgRGB };
}

function styledCell(cell: Cell, token: JeditStyleToken): Cell {
  return { ...cell, fg: token.fg, fgRGB: token.fgRGB, bg: token.bg, bgRGB: token.bgRGB,
    modifiers: token.modifiers == null ? undefined : [...token.modifiers], empty: false };
}
