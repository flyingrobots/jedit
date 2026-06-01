import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { fitLine } from '../../ui/workspace-render.js';
import { clampIndex } from './viewport.js';
import { isWorkspaceDownKey, isWorkspaceUpKey, WorkspaceKeys } from './workspace-key.js';

const KIND_OPEN = 'open';
const KIND_EDIT = 'edit';
const KIND_READ = 'read';
const KIND_CHECKPOINT = 'checkpoint';
const KIND_EXPORT = 'export';
const STATUS_OPENED = 'opened';
const STATUS_APPLIED = 'applied';
const STATUS_OBSERVED = 'observed';
const STATUS_CHECKPOINTED = 'checkpointed';
const STATUS_EXPORTED = 'exported';
const STATUS_OBSTRUCTED = 'obstructed';
const NO_TICK = '-';
const NO_EVIDENCE = '-';
const TITLE = 'Echo History';
const EMPTY_MESSAGE = 'No Echo evidence yet';
const HEADER = '#   tick  kind        status       evidence       summary';
const TICK_PATTERN = /(?:tick|receipt):(\d+)/;
const HISTORY_PAGE_STEP = 10;
const SEQUENCE_CELL_WIDTH = 3;
const TICK_CELL_WIDTH = 5;
const KIND_CELL_WIDTH = 10;
const STATUS_CELL_WIDTH = 12;
const EVIDENCE_CELL_WIDTH = 16;

export const EchoHistoryEntryKinds = Object.freeze({
  Open: KIND_OPEN,
  Edit: KIND_EDIT,
  Read: KIND_READ,
  Checkpoint: KIND_CHECKPOINT,
  Export: KIND_EXPORT,
} as const);

export const EchoHistoryEntryStatuses = Object.freeze({
  Opened: STATUS_OPENED,
  Applied: STATUS_APPLIED,
  Observed: STATUS_OBSERVED,
  Checkpointed: STATUS_CHECKPOINTED,
  Exported: STATUS_EXPORTED,
  Obstructed: STATUS_OBSTRUCTED,
} as const);

export type EchoHistoryEntryKind =
  typeof EchoHistoryEntryKinds[keyof typeof EchoHistoryEntryKinds];

export type EchoHistoryEntryStatus =
  typeof EchoHistoryEntryStatuses[keyof typeof EchoHistoryEntryStatuses];

export interface EchoHistoryEntry {
  readonly sequence: number;
  readonly tickId?: number;
  readonly kind: EchoHistoryEntryKind;
  readonly status: EchoHistoryEntryStatus;
  readonly evidenceId?: string;
  readonly summary: string;
}

export interface EchoHistoryEntryDraft {
  readonly kind: EchoHistoryEntryKind;
  readonly status: EchoHistoryEntryStatus;
  readonly evidenceId?: string;
  readonly summary: string;
}

export function appendEchoHistoryEntry(
  entries: readonly EchoHistoryEntry[],
  draft: EchoHistoryEntryDraft,
): readonly EchoHistoryEntry[] {
  return [
    ...entries,
    {
      sequence: nextSequence(entries),
      tickId: tickIdFromEvidence(draft.evidenceId),
      kind: draft.kind,
      status: draft.status,
      evidenceId: draft.evidenceId,
      summary: draft.summary,
    },
  ];
}

export function sortedEchoHistoryEntries(
  entries: readonly EchoHistoryEntry[],
): readonly EchoHistoryEntry[] {
  return [...entries].sort(compareEchoHistoryEntries);
}

export function updateEchoHistorySelectionFromKey(
  msg: KeyMsg,
  selectedIndex: number,
  entryCount: number,
): number | undefined {
  if (entryCount === 0) {
    return undefined;
  }
  if (isWorkspaceDownKey(msg)) {
    return clampIndex(selectedIndex + 1, entryCount);
  }
  if (isWorkspaceUpKey(msg)) {
    return clampIndex(selectedIndex - 1, entryCount);
  }
  if (msg.key === WorkspaceKeys.PageDown) {
    return clampIndex(selectedIndex + HISTORY_PAGE_STEP, entryCount);
  }
  if (msg.key === WorkspaceKeys.PageUp) {
    return clampIndex(selectedIndex - HISTORY_PAGE_STEP, entryCount);
  }
  return undefined;
}

export function renderEchoHistoryLines(
  entries: readonly EchoHistoryEntry[],
  selectedIndex: number,
  width: number,
  height: number,
): readonly string[] {
  const sorted = sortedEchoHistoryEntries(entries);
  const rows = sorted.length === 0
    ? [EMPTY_MESSAGE]
    : [HEADER, ...visibleRows(sorted, selectedIndex, Math.max(1, height - 2))];
  return [TITLE, ...rows].slice(0, height).map((line) => fitLine(line, width));
}

function visibleRows(
  entries: readonly EchoHistoryEntry[],
  selectedIndex: number,
  visible: number,
): readonly string[] {
  const start = historyScrollStart(selectedIndex, entries.length, visible);
  return entries.slice(start, start + visible).map((entry, offset) => historyRow(entry, start + offset, selectedIndex));
}

function historyRow(entry: EchoHistoryEntry, rowIndex: number, selectedIndex: number): string {
  const prefix = rowIndex === selectedIndex ? '› ' : '  ';
  const cells = [
    cell(String(entry.sequence), SEQUENCE_CELL_WIDTH),
    cell(tickLabel(entry), TICK_CELL_WIDTH),
    cell(entry.kind, KIND_CELL_WIDTH),
    cell(entry.status, STATUS_CELL_WIDTH),
    cell(entry.evidenceId ?? NO_EVIDENCE, EVIDENCE_CELL_WIDTH),
    entry.summary,
  ];
  return `${prefix}${cells.join(' ')}`;
}

function historyScrollStart(selectedIndex: number, total: number, visible: number): number {
  if (total <= visible) {
    return 0;
  }
  const half = Math.floor(visible / 2);
  return Math.min(Math.max(0, selectedIndex - half), total - visible);
}

function cell(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width, ' ');
}

function tickLabel(entry: EchoHistoryEntry): string {
  return entry.tickId == null ? NO_TICK : String(entry.tickId);
}

function nextSequence(entries: readonly EchoHistoryEntry[]): number {
  return (entries.at(-1)?.sequence ?? 0) + 1;
}

function tickIdFromEvidence(evidenceId: string | undefined): number | undefined {
  const match = evidenceId?.match(TICK_PATTERN);
  if (match?.[1] == null) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compareEchoHistoryEntries(left: EchoHistoryEntry, right: EchoHistoryEntry): number {
  if (left.tickId != null && right.tickId != null && left.tickId !== right.tickId) {
    return left.tickId - right.tickId;
  }
  return left.sequence - right.sequence;
}
