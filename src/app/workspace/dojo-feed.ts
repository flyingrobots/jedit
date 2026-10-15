import type { Cmd, KeyMsg, MouseMsg } from '@flyingrobots/bijou-tui';
import { JEDIT_DOJO_FEED_TOGGLE_KEY } from '../keybindings.js';
import { dojoFeedLayout, dojoFeedScrollLimit } from '../../ui/dojo-feed-drawer.js';
import { mouseScrollDeltaRows } from '../../ui/mouse-scroll.js';
import { MIN_COLUMNS, MIN_ROWS } from './viewport.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';

type Result = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
const SCROLL_STEP = 1;
const PAGE_STEP = 5;
const SCROLL_KEYS = new Map<string, number>([
  [WorkspaceKeys.J, SCROLL_STEP], [WorkspaceKeys.ArrowDown, SCROLL_STEP],
  [WorkspaceKeys.K, -SCROLL_STEP], [WorkspaceKeys.ArrowUp, -SCROLL_STEP],
  [WorkspaceKeys.PageDown, PAGE_STEP], [WorkspaceKeys.PageUp, -PAGE_STEP],
]);
const HOME = 'home';
const END = 'end';
const MOUSE_PRESS = 'press';
const MOUSE_LEFT = 'left';

export function updateDojoFeedKey(msg: KeyMsg, model: WorkspaceModel): Result | undefined {
  if (model.quitConfirmOpen || isForceQuit(msg)) return undefined;
  if (model.dojoFeedDrawer == null) return openFromKey(msg, model);
  if (!isPlain(msg)) return [model, []];
  if (msg.key === JEDIT_DOJO_FEED_TOGGLE_KEY || msg.key === WorkspaceKeys.Escape) return close(model);
  return [scrollFromKey(model, msg.key), []];
}

function openFromKey(msg: KeyMsg, model: WorkspaceModel): Result | undefined {
  if (!isPlain(msg) || msg.key !== JEDIT_DOJO_FEED_TOGGLE_KEY || hasModalOwner(model)) return undefined;
  return [{ ...model, dojoFeedDrawer: { scrollRow: 0 }, fileSearchEditing: false }, []];
}

function isPlain(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && !msg.shift;
}

function isForceQuit(msg: KeyMsg): boolean {
  return msg.ctrl === true && msg.key === WorkspaceKeys.C;
}

export function updateDojoFeedMouse(msg: MouseMsg, model: WorkspaceModel): Result | undefined {
  if (model.dojoFeedDrawer == null) return undefined;
  if (model.quitConfirmOpen || model.columns < MIN_COLUMNS || model.rows < MIN_ROWS) return [model, []];
  if (!withinDrawer(msg, model)) return [model, []];
  if (isCloseClick(msg, model)) return close(model);
  return [scroll(model, (model.dojoFeedDrawer?.scrollRow ?? 0) + mouseScrollDeltaRows(msg)), []];
}

function withinDrawer(msg: MouseMsg, model: WorkspaceModel): boolean {
  const bounds = dojoFeedLayout(model);
  return msg.col >= bounds.x && msg.col < bounds.x + bounds.width && msg.row >= bounds.y && msg.row < bounds.y + bounds.height;
}

function isCloseClick(msg: MouseMsg, model: WorkspaceModel): boolean {
  const bounds = dojoFeedLayout(model);
  return msg.row === bounds.closeY && msg.col >= bounds.closeX && msg.col < bounds.closeX + bounds.closeWidth
    && msg.action === MOUSE_PRESS && msg.button === MOUSE_LEFT;
}

function hasModalOwner(model: WorkspaceModel): boolean {
  return model.settingsOpen || model.startupFileModalOpen || model.commandLine.active;
}

function scrollFromKey(model: WorkspaceModel, key: string): WorkspaceModel {
  if (key === HOME) return scroll(model, 0);
  if (key === END) return scroll(model, dojoFeedScrollLimit(model));
  return scroll(model, (model.dojoFeedDrawer?.scrollRow ?? 0) + (SCROLL_KEYS.get(key) ?? 0));
}

function scroll(model: WorkspaceModel, row: number): WorkspaceModel {
  const scrollRow = Math.max(0, Math.min(row, dojoFeedScrollLimit(model)));
  return scrollRow === model.dojoFeedDrawer?.scrollRow ? model : { ...model, dojoFeedDrawer: { scrollRow } };
}

function close(model: WorkspaceModel): Result {
  return [{ ...model, dojoFeedDrawer: undefined }, []];
}
