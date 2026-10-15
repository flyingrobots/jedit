import { FileEntryKinds, type FileEntry } from '../ports/file-system.js';
import { fitLine } from './fit-line.js';

export { fitLine } from './fit-line.js';

export interface GraftOutlineDisplayItem {
  readonly kind: string;
  readonly name: string;
  readonly startLine: number;
}

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
  const prefix = options.selected ? '› ' : '  ';
  return `${prefix}${item.kind} ${item.name} · ${String(item.startLine)}`;
}

export interface TreeLineOptions extends SelectableLineOptions {
  readonly depth?: number;
  readonly expanded?: boolean;
}

export function fileTreeNameColumn(entry: FileEntry, depth = 0): number {
  return 2 + depth * 2 + (entry.kind === FileEntryKinds.Directory ? 2 : 0);
}

export function formatTreeLine(entry: FileEntry, options: TreeLineOptions): string {
  const prefix = options.selected ? '› ' : '  ';
  if (entry.kind === FileEntryKinds.Parent) {
    return `${prefix}../`;
  }
  if (entry.kind === FileEntryKinds.Directory) {
    const disclosure = options.expanded ? '▾' : '▸';
    return `${prefix}${'  '.repeat(options.depth ?? 0)}${disclosure} ${entry.name}/`;
  }
  return `${prefix}${'  '.repeat(options.depth ?? 0)}${entry.name}`;
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
