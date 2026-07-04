import type { KeyMsg } from '@flyingrobots/bijou-tui';
import type { I18nPort } from '../../ports/i18n.js';
import { fitLine } from '../../ui/fit-line.js';
import { clampIndex } from './viewport.js';
import { isWorkspaceDownKey, isWorkspaceUpKey, WorkspaceKeys } from './workspace-key.js';
import {
  MAIN_WORLDLINE_NAME,
  WorkspaceWorldlineNodeKinds,
  WorkspaceWorldlinePostureKinds,
  WorkspaceWorldlineMaterializationKinds,
  workspaceWorldlinePostureLabel,
  type WorkspaceWorldlineGraphNode,
  type WorkspaceWorldlineMaterializationKind,
  type WorkspaceWorldlineState,
} from './worldline-types.js';

const GRAPH_PAGE_STEP = 10;
const TITLE_KEY = 'worldline.title';
const EMPTY_KEY = 'worldline.empty';
const HEADER_KEY = 'worldline.header';
const NO_TICK = '-';
const EMPTY_ENTRY_COUNT = 0;
const EMPTY_LENGTH = 0;
const MIN_VISIBLE_ROWS = 1;
const HEADER_ROW_COUNT = 2;
const KIND_CELL_WIDTH = 9;
const NAME_CELL_WIDTH = 14;
const BASIS_CELL_WIDTH = 14;
const HEAD_CELL_WIDTH = 5;
const DELTA_CELL_WIDTH = 9;
const CONFLICT_CELL_WIDTH = 10;
const FIRST_ROW = 0;
const WORLDLINE_PREFIX = 'worldline:';
const EXPORT_HOST = 'export:host';
const EXPORT_PENDING = 'export:pending';
const EXPORT_NONE = 'export:none';
const ADMIT_PREFIX = 'admit:';
const TICK_PREFIX = 'tick:t';
const TICKS_PREFIX = 'ticks:t';
const TICK_SPAN_SEPARATOR = '->t';

export interface WorkspaceWorldlineContextState {
  readonly worldline: WorkspaceWorldlineState;
  readonly materialization: WorkspaceWorldlineMaterializationKind;
}

export function workspaceWorldlineContextLabel(
  state: WorkspaceWorldlineContextState,
): string {
  const node = currentWorldlineGraphNode(state.worldline);
  return [
    `${WORLDLINE_PREFIX}${workspaceWorldlinePostureLabel(state.worldline.posture)}`,
    workspaceWorldlineExportLabel(state.materialization),
    `${ADMIT_PREFIX}${state.worldline.posture.admissionTarget}`,
    node == null ? undefined : worldlineTickSpanLabel(node),
  ].filter((part): part is string => part != null && part.length > EMPTY_LENGTH).join(' | ');
}

export function renderWorldlineGraphLines(
  worldline: WorkspaceWorldlineState,
  width: number,
  height: number,
  i18n: I18nPort,
): readonly string[] {
  const rows = worldline.graph.length === EMPTY_ENTRY_COUNT
    ? [i18n.t(EMPTY_KEY)]
    : [
        i18n.t(HEADER_KEY),
        ...visibleGraphRows(worldline, Math.max(MIN_VISIBLE_ROWS, height - HEADER_ROW_COUNT)),
      ];
  return [i18n.t(TITLE_KEY), ...rows]
    .slice(FIRST_ROW, height)
    .map((line) => fitLine(line, width));
}

export function updateWorldlineGraphSelectionFromKey(
  msg: KeyMsg,
  selectedIndex: number,
  entryCount: number,
): number | undefined {
  if (entryCount === EMPTY_ENTRY_COUNT) {
    return undefined;
  }
  if (isWorkspaceDownKey(msg)) {
    return clampIndex(selectedIndex + MIN_VISIBLE_ROWS, entryCount);
  }
  if (isWorkspaceUpKey(msg)) {
    return clampIndex(selectedIndex - MIN_VISIBLE_ROWS, entryCount);
  }
  if (msg.key === WorkspaceKeys.PageDown) {
    return clampIndex(selectedIndex + GRAPH_PAGE_STEP, entryCount);
  }
  if (msg.key === WorkspaceKeys.PageUp) {
    return clampIndex(selectedIndex - GRAPH_PAGE_STEP, entryCount);
  }
  return undefined;
}

export function worldlineGraphContextLine(worldline: WorkspaceWorldlineState): string {
  return `Worldlines: ${worldline.graph.length} | ${workspaceWorldlinePostureLabel(worldline.posture)}`;
}

function visibleGraphRows(
  worldline: WorkspaceWorldlineState,
  visible: number,
): readonly string[] {
  const start = graphScrollStart(
    worldline.selectedGraphIndex,
    worldline.graph.length,
    visible,
  );
  return worldline.graph
    .slice(start, start + visible)
    .map((node, offset) =>
      worldlineGraphRow(node, start + offset, worldline.selectedGraphIndex)
    );
}

function worldlineGraphRow(
  node: WorkspaceWorldlineGraphNode,
  rowIndex: number,
  selectedIndex: number,
): string {
  const prefix = rowIndex === selectedIndex ? '> ' : '  ';
  return [
    prefix,
    cell(node.kind, KIND_CELL_WIDTH),
    cell(node.name, NAME_CELL_WIDTH),
    cell(node.basis, BASIS_CELL_WIDTH),
    cell(tickLabel(node.headTick), HEAD_CELL_WIDTH),
    cell(worldlineDeltaLabel(node), DELTA_CELL_WIDTH),
    cell(node.conflict, CONFLICT_CELL_WIDTH),
    braidStatusLabel(node),
  ].filter((part) => part.length > EMPTY_LENGTH).join(' ');
}

function graphScrollStart(selectedIndex: number, total: number, visible: number): number {
  if (total <= visible) {
    return FIRST_ROW;
  }
  const half = Math.floor(visible / HEADER_ROW_COUNT);
  return Math.min(Math.max(FIRST_ROW, selectedIndex - half), total - visible);
}

function currentWorldlineGraphNode(
  worldline: WorkspaceWorldlineState,
): WorkspaceWorldlineGraphNode | undefined {
  if (worldline.posture.kind === WorkspaceWorldlinePostureKinds.Canonical ||
    worldline.posture.kind === WorkspaceWorldlinePostureKinds.Historical) {
    return worldline.graph.find((node) => node.name === MAIN_WORLDLINE_NAME);
  }
  return worldline.graph.find((node) => node.name === worldline.posture.name);
}

function worldlineDeltaLabel(node: WorkspaceWorldlineGraphNode): string {
  return `+${node.ahead}/-${node.behind}`;
}

function workspaceWorldlineExportLabel(
  materialization: WorkspaceWorldlineMaterializationKind,
): string {
  if (materialization === WorkspaceWorldlineMaterializationKinds.Materialized) {
    return EXPORT_HOST;
  }
  return materialization === WorkspaceWorldlineMaterializationKinds.Unmaterialized
    ? EXPORT_PENDING
    : EXPORT_NONE;
}

function worldlineTickSpanLabel(node: WorkspaceWorldlineGraphNode): string | undefined {
  if (node.basisTick == null && node.headTick == null) {
    return undefined;
  }
  if (node.basisTick == null) {
    return `${TICK_PREFIX}${node.headTick}`;
  }
  if (node.headTick == null || node.basisTick === node.headTick) {
    return `${TICK_PREFIX}${node.basisTick}`;
  }
  return `${TICKS_PREFIX}${node.basisTick}${TICK_SPAN_SEPARATOR}${node.headTick}`;
}

function braidStatusLabel(node: WorkspaceWorldlineGraphNode): string {
  if (node.kind !== WorkspaceWorldlineNodeKinds.Braid) {
    return '';
  }
  return node.admitted === true ? 'admitted' : 'preview';
}

function tickLabel(tick: number | undefined): string {
  return tick == null ? NO_TICK : String(tick);
}

function cell(value: string, width: number): string {
  return value.length >= width ? value.slice(FIRST_ROW, width) : value.padEnd(width, ' ');
}
