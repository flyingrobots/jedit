import { clipToWidth } from '@flyingrobots/bijou-tui';

import type { FileEntry } from '../ports/file-system.js';

export interface GraftOutlineDisplayItem {
  readonly kind: string;
  readonly name: string;
  readonly startLine: number;
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

export function fitLine(text: string, width: number): string {
  const clipped = clipToWidth(text, width);
  const visible = [...clipped].length;
  if (visible >= width) {
    return clipped;
  }
  return clipped.padEnd(width, ' ');
}

export function formatGraftOutlineLine(item: GraftOutlineDisplayItem, selected: boolean): string {
  const prefix = selected ? '› ' : '  ';
  return `${prefix}${item.kind} ${item.name} · ${String(item.startLine)}`;
}

export function formatTreeLine(entry: FileEntry, selected: boolean): string {
  const prefix = selected ? '› ' : '  ';
  if (entry.kind === 'parent') {
    return `${prefix}../`;
  }
  if (entry.kind === 'dir') {
    return `${prefix}${entry.name}/`;
  }
  return `${prefix}${entry.name}`;
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
