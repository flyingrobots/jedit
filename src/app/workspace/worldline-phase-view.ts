import type { I18nPort } from '../../ports/i18n.js';
import { fitLine } from '../../ui/fit-line.js';
import { EchoHistoryEntryKinds, EchoHistoryEntryStatuses, type EchoHistoryEntry } from './echo-history.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceTextAuthorityKinds, WorkspaceTextIntentStatuses } from './workspace-text-authority.js';
import {
  MAIN_WORLDLINE_NAME,
  WorkspaceWorldlineConflictKinds,
  WorkspaceWorldlineNodeKinds,
  WorkspaceWorldlinePhaseKinds,
  type WorkspaceWorldlineGraphNode,
  type WorkspaceWorldlinePhaseKind,
} from './worldline-types.js';
import { workspaceWorldlineTickSpanLabel } from './worldline-tick-span.js';

const TITLE_KEY = 'worldline.title';
const EMPTY_LENGTH = 0;
const FIRST_ROW = 0;
const MIN_VISIBLE_ROWS = 1;
const PHASE_CELL_WIDTH = 11;
const RAIL_CELL_WIDTH = 1;
const NAME_CELL_WIDTH = 14;
const BASIS_CELL_WIDTH = 14;
const HEAD_CELL_WIDTH = 5;
const SPAN_CELL_WIDTH = 9;
const EVIDENCE_CELL_WIDTH = 18;
const SELECTED_CELL_WIDTH = 1;
const NO_EVIDENCE = '-';
const NO_HEAD = '-';
const CANONICAL_RAIL = 'C';
const STRAND_RAIL = 'S';
const AGENT_RAIL = 'A';
const BRAID_RAIL = 'B';
const LOCAL_RAIL = 'L';
const PROJECTION_PREFIX = 'projection:';
const CANONICAL_PREFIX = 'canonical@t';
const LOCAL_NAME = 'local';
const VISIBLE_BRAID_NAME = 'visible braid';
const LOCAL_SPAN = 'local';
const OPTIMISTIC_NOTE = 'optimistic';
const ACTIVE_NOTE = 'active';
const CONFLICT_NOTE = 'conflict';
const BLOCKED_NOTE = 'blocked';
const PHASE_HEADER = 's phase       r name           basis          head  span      evidence           note';
const SELECTED_MARKER = '>';
const UNSELECTED_MARKER = ' ';

interface WorldlinePhaseRow {
  readonly selected: boolean;
  readonly phase: WorkspaceWorldlinePhaseKind;
  readonly rail: string;
  readonly name: string;
  readonly basis: string;
  readonly head: string;
  readonly span: string;
  readonly evidence: string;
  readonly note: string;
}

interface GraphNodePhaseRowOptions {
  readonly selected: boolean;
}

export function renderWorkspaceWorldlinePhaseLines(
  model: WorkspaceModel,
  width: number,
  height: number,
  i18n: I18nPort,
): readonly string[] {
  const rows = worldlinePhaseRows(model);
  return [
    i18n.t(TITLE_KEY),
    projectionLine(model, rows),
    PHASE_HEADER,
    ...rows.map(renderPhaseRow),
  ]
    .slice(FIRST_ROW, Math.max(MIN_VISIBLE_ROWS, height))
    .map((line) => fitLine(line, width));
}

function worldlinePhaseRows(model: WorkspaceModel): readonly WorldlinePhaseRow[] {
  const baseRows = model.worldline.graph.map((node, index) =>
    graphNodePhaseRow(node, { selected: index === model.worldline.selectedGraphIndex })
  );
  const local = localOptimisticRow(model);
  return local == null
    ? baseRows
    : [...baseRows, local, visibleBraidRow(model, local.phase)];
}

function projectionLine(
  model: WorkspaceModel,
  rows: readonly WorldlinePhaseRow[],
): string {
  const local = rows.find((row) => row.rail === LOCAL_RAIL);
  const canonical = canonicalRef(model);
  return local == null
    ? `${PROJECTION_PREFIX} ${canonical} | phase:${WorkspaceWorldlinePhaseKinds.Settled}`
    : `${PROJECTION_PREFIX} ${canonical} + local optimistic | braid active | phase:${local.phase}`;
}

function graphNodePhaseRow(
  node: WorkspaceWorldlineGraphNode,
  options: GraphNodePhaseRowOptions,
): WorldlinePhaseRow {
  return {
    selected: options.selected,
    phase: graphNodePhase(node),
    rail: graphNodeRail(node),
    name: node.name,
    basis: node.basis,
    head: node.headTick == null ? NO_HEAD : String(node.headTick),
    span: workspaceWorldlineTickSpanLabel(node) ?? NO_EVIDENCE,
    evidence: node.headTick == null ? NO_EVIDENCE : `${CANONICAL_PREFIX}${node.headTick}`,
    note: graphNodeNote(node),
  };
}

function localOptimisticRow(model: WorkspaceModel): WorldlinePhaseRow | undefined {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened ||
    model.textAuthority.dirty !== true) {
    return undefined;
  }
  const latest = latestEditEntry(model.echoHistory);
  const phase = localOptimisticPhase(model, latest);
  return {
    selected: false,
    phase,
    rail: LOCAL_RAIL,
    name: LOCAL_NAME,
    basis: canonicalRef(model),
    head: NO_HEAD,
    span: LOCAL_SPAN,
    evidence: localOptimisticEvidence(model, latest),
    note: localOptimisticNote(phase),
  };
}

function visibleBraidRow(
  model: WorkspaceModel,
  phase: WorkspaceWorldlinePhaseKind,
): WorldlinePhaseRow {
  return {
    selected: false,
    phase,
    rail: BRAID_RAIL,
    name: VISIBLE_BRAID_NAME,
    basis: `${MAIN_WORLDLINE_NAME}+${LOCAL_NAME}`,
    head: NO_HEAD,
    span: LOCAL_SPAN,
    evidence: canonicalRef(model),
    note: ACTIVE_NOTE,
  };
}

function latestEditEntry(entries: readonly EchoHistoryEntry[]): EchoHistoryEntry | undefined {
  return entries.findLast((entry) => entry.kind === EchoHistoryEntryKinds.Edit);
}

function localOptimisticPhase(
  model: WorkspaceModel,
  latest: EchoHistoryEntry | undefined,
): WorkspaceWorldlinePhaseKind {
  const status = model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? model.textAuthority.pendingIntentStatus
    : undefined;
  if (status === WorkspaceTextIntentStatuses.Obstructed ||
    latest?.status === EchoHistoryEntryStatuses.Obstructed) {
    return WorkspaceWorldlinePhaseKinds.Conflicted;
  }
  if (status === WorkspaceTextIntentStatuses.Blocked ||
    latest?.status === EchoHistoryEntryStatuses.Blocked) {
    return WorkspaceWorldlinePhaseKinds.Pending;
  }
  if (status === WorkspaceTextIntentStatuses.Admitted) {
    return WorkspaceWorldlinePhaseKinds.Admitted;
  }
  return WorkspaceWorldlinePhaseKinds.Unconfirmed;
}

function localOptimisticEvidence(
  model: WorkspaceModel,
  latest: EchoHistoryEntry | undefined,
): string {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return NO_EVIDENCE;
  }
  if (latest?.status === EchoHistoryEntryStatuses.Obstructed) {
    return latest.summary;
  }
  if (model.textAuthority.lastObstruction != null) {
    return model.textAuthority.lastObstruction.message;
  }
  return model.textAuthority.pendingReceiptId
    ?? model.textAuthority.lastReceiptId
    ?? `request:${model.textAuthority.pendingClientSeq ?? model.textRequestId}`;
}

function localOptimisticNote(phase: WorkspaceWorldlinePhaseKind): string {
  if (phase === WorkspaceWorldlinePhaseKinds.Conflicted) {
    return CONFLICT_NOTE;
  }
  return phase === WorkspaceWorldlinePhaseKinds.Pending ? BLOCKED_NOTE : OPTIMISTIC_NOTE;
}

function graphNodePhase(node: WorkspaceWorldlineGraphNode): WorkspaceWorldlinePhaseKind {
  if (node.conflict !== WorkspaceWorldlineConflictKinds.Clear) {
    return WorkspaceWorldlinePhaseKinds.Conflicted;
  }
  if (node.kind === WorkspaceWorldlineNodeKinds.Canonical) {
    return WorkspaceWorldlinePhaseKinds.Settled;
  }
  return node.admitted === true
    ? WorkspaceWorldlinePhaseKinds.Admitted
    : WorkspaceWorldlinePhaseKinds.Pending;
}

function graphNodeRail(node: WorkspaceWorldlineGraphNode): string {
  if (node.kind === WorkspaceWorldlineNodeKinds.Canonical) {
    return CANONICAL_RAIL;
  }
  if (node.kind === WorkspaceWorldlineNodeKinds.Agent) {
    return AGENT_RAIL;
  }
  return node.kind === WorkspaceWorldlineNodeKinds.Braid ? BRAID_RAIL : STRAND_RAIL;
}

function graphNodeNote(node: WorkspaceWorldlineGraphNode): string {
  if (node.kind !== WorkspaceWorldlineNodeKinds.Braid) {
    return node.conflict;
  }
  return node.admitted === true ? WorkspaceWorldlinePhaseKinds.Admitted : 'preview';
}

function canonicalRef(model: WorkspaceModel): string {
  return `${CANONICAL_PREFIX}${model.worldline.canonicalHeadTick}`;
}

function renderPhaseRow(row: WorldlinePhaseRow): string {
  return [
    cell(row.selected ? SELECTED_MARKER : UNSELECTED_MARKER, SELECTED_CELL_WIDTH),
    cell(row.phase, PHASE_CELL_WIDTH),
    cell(row.rail, RAIL_CELL_WIDTH),
    cell(row.name, NAME_CELL_WIDTH),
    cell(row.basis, BASIS_CELL_WIDTH),
    cell(row.head, HEAD_CELL_WIDTH),
    cell(row.span, SPAN_CELL_WIDTH),
    cell(row.evidence, EVIDENCE_CELL_WIDTH),
    row.note,
  ].filter((part) => part.length > EMPTY_LENGTH).join(' ');
}

function cell(value: string, width: number): string {
  return value.length >= width ? value.slice(FIRST_ROW, width) : value.padEnd(width, ' ');
}
