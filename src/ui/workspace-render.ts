import { FileEntryKinds, type FileEntry } from '../ports/file-system.js';
import { fitLine } from './fit-line.js';

export { fitLine, wrapLine } from './fit-line.js';

export interface GraftOutlineDisplayItem {
  readonly kind: string;
  readonly name: string;
  readonly startLine: number;
}

const SELECTED_ROW_PREFIX = '› ';
const TREE_INDENT = '  ';
const UNSELECTED_ROW_PREFIX = TREE_INDENT;

export interface SelectableLineOptions {
  readonly selected: boolean;
}

export function fitBlock(text: string, width: number, height: number): string {
  const rawLines = text.split('\n');
  const lines: string[] = [];

  for (let i = 0; i < height; i += 1) {
    const line = rawLines[i] ?? '';
    lines.push(fitLine(line, width));
  }

  return lines.join('\n');
}

export function formatGraftOutlineLine(item: GraftOutlineDisplayItem, options: SelectableLineOptions): string {
  const prefix = options.selected ? SELECTED_ROW_PREFIX : UNSELECTED_ROW_PREFIX;
  return `${prefix}${item.kind} ${item.name} · ${String(item.startLine)}`;
}

export interface TreeLineOptions extends SelectableLineOptions {
  readonly depth?: number;
  readonly expanded?: boolean;
}

const TREE_PREFIX_CELLS = 2;
const TREE_INDENT_CELLS = TREE_INDENT.length;
const TREE_DISCLOSURE_CELLS = 2;
const ROOT_DEPTH = 0;

export function fileTreeNameColumn(entry: FileEntry, depth = ROOT_DEPTH): number {
  return TREE_PREFIX_CELLS + depth * TREE_INDENT_CELLS + (entry.kind === FileEntryKinds.Directory ? TREE_DISCLOSURE_CELLS : 0);
}

const TREE_PARENT_LABEL = '../';
const DISCLOSURE_GAP = ' ';
const DIRECTORY_SUFFIX = '/';
const DISCLOSURE_OPEN = '▾';
const DISCLOSURE_CLOSED = '▸';

export function formatTreeLine(entry: FileEntry, options: TreeLineOptions): string {
  const prefix = options.selected ? SELECTED_ROW_PREFIX : UNSELECTED_ROW_PREFIX;
  if (entry.kind === FileEntryKinds.Parent) {
    return `${prefix}${TREE_PARENT_LABEL}`;
  }
  if (entry.kind === FileEntryKinds.Directory) {
    const disclosure = options.expanded ? DISCLOSURE_OPEN : DISCLOSURE_CLOSED;
    return `${prefix}${TREE_INDENT.repeat(options.depth ?? ROOT_DEPTH)}${disclosure}${DISCLOSURE_GAP}${entry.name}${DIRECTORY_SUFFIX}`;
  }
  return `${prefix}${TREE_INDENT.repeat(options.depth ?? ROOT_DEPTH)}${entry.name}`;
}

export function graftOutlineScroll(selectedIndex: number, total: number, visible: number): number {
  if (total <= visible) {
    return 0;
  }
  const half = Math.floor(visible / 2);
  const candidate = Math.max(0, selectedIndex - half);
  return Math.min(candidate, total - visible);
}

export function graftVisibleOutlineRows(bodyHeight: number, innerPad: number, metaRows: number, changeRows: number): number {
  const innerHeight = Math.max(1, bodyHeight - (innerPad * 2));
  return Math.max(1, innerHeight - metaRows - changeRows);
}

export function renderMarkdownPreview(text: string): string {
  const lines = text.split('\n');
  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      return '';
    }
    if (/^\s*#{1,6}\s+/.test(line)) {
      return line.replace(/^\s*#{1,6}\s+/, '').toUpperCase();
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return line.replace(/^\s*[-*]\s+/, '• ');
    }
    if (/^\s*>\s+/.test(line)) {
      return line.replace(/^\s*>\s+/, '│ ');
    }
    return line;
  }).join('\n');
}
