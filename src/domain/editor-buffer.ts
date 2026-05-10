import { joinLines } from '../app/editor-lines.js';
import {
  nextWordStartIndex,
  previousWordStartIndex,
  wordEndIndex,
} from './editor-word-logic.js';

export class EditorBuffer {
  readonly lines: readonly string[];

  constructor(lines: readonly string[]) {
    this.lines = lines;
    Object.freeze(this);
  }

  static empty(): EditorBuffer {
    return new EditorBuffer(['']);
  }

  lineAt(row: number): string {
    return this.lines[row] ?? '';
  }

  lineCount(): number {
    return this.lines.length;
  }

  text(): string {
    return joinLines(this.lines);
  }

  lineStartTextIndex(row: number): number {
    let index = 0;
    for (let currentRow = 0; currentRow < row; currentRow += 1) {
      index += (this.lines[currentRow] ?? '').length;
      if (currentRow < this.lines.length - 1) {
        index += 1;
      }
    }
    return index;
  }

  textIndex(row: number, col: number): number {
    const line = this.lineAt(row);
    const clampedCol = line.length === 0 ? 0 : Math.max(0, Math.min(col, line.length - 1));
    return this.lineStartTextIndex(row) + clampedCol;
  }

  nextWordStart(index: number): number {
    return nextWordStartIndex(this.text(), index);
  }

  prevWordStart(index: number): number {
    return previousWordStartIndex(this.text(), index);
  }

  wordEnd(index: number): number {
    return wordEndIndex(this.text(), index);
  }

  positionAt(index: number): { row: number; col: number; isInsert: boolean } {
    let remaining = Math.max(0, index);
    for (let row = 0; row < this.lines.length; row += 1) {
      const line = this.lines[row] ?? '';
      if (remaining <= line.length) {
        return { row, col: remaining, isInsert: true };
      }
      remaining -= (line.length + 1);
    }
    const lastRow = Math.max(0, this.lines.length - 1);
    return { row: lastRow, col: (this.lines[lastRow] ?? '').length, isInsert: true };
  }

  replaceLine(row: number, content: string): EditorBuffer {
    return new EditorBuffer(this.lines.map((line, index) => (index === row ? content : line)));
  }

  insertLine(row: number, content: string): EditorBuffer {
    return new EditorBuffer([...this.lines.slice(0, row), content, ...this.lines.slice(row)]);
  }

  deleteLine(row: number): EditorBuffer {
    if (this.lines.length <= 1) return EditorBuffer.empty();
    return new EditorBuffer([...this.lines.slice(0, row), ...this.lines.slice(row + 1)]);
  }
}
