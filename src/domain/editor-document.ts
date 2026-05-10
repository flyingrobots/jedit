import { EditorBuffer } from './editor-buffer.js';
import { EditorCursor } from './editor-cursor.js';
import type { EditorMotion, EditorMutation, RegisterState, RegisterKind } from './editor-state.js';
import { normalizeLines } from '../app/editor-lines.js';

export class EditorDocument {
  readonly buffer: EditorBuffer;
  readonly cursor: EditorCursor;

  constructor(buffer: EditorBuffer, cursor: EditorCursor) {
    this.buffer = buffer;
    this.cursor = cursor;
    Object.freeze(this);
  }

  with(patch: { buffer?: EditorBuffer; cursor?: EditorCursor }): EditorDocument {
    return new EditorDocument(patch.buffer ?? this.buffer, patch.cursor ?? this.cursor);
  }

  applyMotion(motion: EditorMotion, isInsert: boolean): EditorDocument {
    switch (motion.type) {
      case 'char': return this.applyCharMotion(motion.direction, isInsert, motion.delta ?? 1);
      case 'word': return this.applyWordMotion(motion.target);
      case 'line': return this.applyLineMotion(motion.target);
      case 'document': return this.applyDocumentMotion(motion.target);
    }
  }

  applyMutation(mutation: EditorMutation, register: RegisterState | undefined): { doc: EditorDocument; nextRegister?: RegisterState; nextMode?: 'normal' | 'insert' } {
    switch (mutation.type) {
      case 'insert': return { doc: this.insert(mutation.text) };
      case 'delete': return this.delete(mutation.target);
      case 'newline': return { doc: this.newline() };
      case 'backspace': return { doc: this.backspace() };
      case 'paste': return { doc: this.paste(mutation.placement, register) };
      case 'yank': return { doc: this, nextRegister: this.yank(mutation.target) };
    }
  }

  private applyCharMotion(direction: 'left' | 'right' | 'up' | 'down', isInsert: boolean, delta: number): EditorDocument {
    if (isInsert) {
      if (direction === 'left' && this.cursor.col < delta && this.cursor.row > 0) {
        const prevLine = this.buffer.lineAt(this.cursor.row - 1);
        return this.with({ cursor: new EditorCursor(this.cursor.row - 1, prevLine.length) });
      }
      if (direction === 'right' && this.cursor.col + delta > this.buffer.lineAt(this.cursor.row).length && this.cursor.row < this.buffer.lineCount() - 1) {
        return this.with({ cursor: new EditorCursor(this.cursor.row + 1, 0) });
      }
    }

    const nextCursor = this.cursor.moveChar(direction, this.buffer.lineCount(), this.buffer.lineAt(this.cursor.row), isInsert, delta);
    const clampedCursor = nextCursor.clamp(this.buffer.lineCount(), this.buffer.lineAt(nextCursor.row), isInsert);
    return this.with({ cursor: clampedCursor });
  }

  private applyWordMotion(target: 'start' | 'prev-start' | 'end'): EditorDocument {
    const currentIdx = this.buffer.textIndex(this.cursor.row, this.cursor.col);
    let targetIdx: number;
    switch (target) {
      case 'start': targetIdx = this.buffer.nextWordStart(currentIdx); break;
      case 'prev-start': targetIdx = this.buffer.prevWordStart(currentIdx); break;
      case 'end': targetIdx = this.buffer.wordEnd(currentIdx); break;
    }
    const pos = this.buffer.positionAt(targetIdx);
    return this.with({ cursor: new EditorCursor(pos.row, pos.col) });
  }

  private applyLineMotion(target: 'start' | 'end' | 'first-non-whitespace'): EditorDocument {
    const line = this.buffer.lineAt(this.cursor.row);
    let col: number;
    switch (target) {
      case 'start': col = 0; break;
      case 'end': col = line.length === 0 ? 0 : line.length - 1; break;
      case 'first-non-whitespace': {
        const match = line.match(/\S/);
        col = match == null ? 0 : match.index ?? 0;
        break;
      }
    }
    return this.with({ cursor: new EditorCursor(this.cursor.row, col) });
  }

  private applyDocumentMotion(target: 'top' | 'bottom'): EditorDocument {
    const row = target === 'top' ? 0 : this.buffer.lineCount() - 1;
    const line = this.buffer.lineAt(row);
    const col = Math.max(0, Math.min(this.cursor.col, line.length === 0 ? 0 : line.length - 1));
    return this.with({ cursor: new EditorCursor(row, col) });
  }

  private insert(text: string): EditorDocument {
    const line = this.buffer.lineAt(this.cursor.row);
    const nextLine = `${line.slice(0, this.cursor.col)}${text}${line.slice(this.cursor.col)}`;
    return this.with({
      buffer: this.buffer.replaceLine(this.cursor.row, nextLine),
      cursor: new EditorCursor(this.cursor.row, this.cursor.col + text.length),
    });
  }

  private delete(target: 'char' | 'line' | 'to-end'): { doc: EditorDocument; nextRegister?: RegisterState; nextMode?: 'normal' | 'insert' } {
    if (target === 'char') {
       const text = this.buffer.text();
       if (text.length === 0) return { doc: this };
       const start = this.buffer.textIndex(this.cursor.row, this.cursor.col);
       return this.deleteTextRange(start, start + 1, 'normal', 'char');
    }
    if (target === 'line') {
       const register: RegisterState = { kind: 'line', text: this.buffer.lineAt(this.cursor.row) };
       const nextBuffer = this.buffer.deleteLine(this.cursor.row);
       const nextRow = Math.min(this.cursor.row, nextBuffer.lineCount() - 1);
       const nextLine = nextBuffer.lineAt(nextRow);
       return {
         doc: this.with({ buffer: nextBuffer, cursor: new EditorCursor(nextRow, 0).clamp(nextBuffer.lineCount(), nextLine, false) }),
         nextRegister: register,
       };
    }
    // to-end
    const line = this.buffer.lineAt(this.cursor.row);
    const lineStart = this.buffer.lineStartTextIndex(this.cursor.row);
    return this.deleteTextRange(this.buffer.textIndex(this.cursor.row, this.cursor.col), lineStart + line.length, 'normal', 'char');
  }

  private deleteTextRange(start: number, end: number, mode: 'normal' | 'insert', registerKind: RegisterKind): { doc: EditorDocument; nextRegister?: RegisterState; nextMode?: 'normal' | 'insert' } {
    const text = this.buffer.text();
    const from = Math.max(0, Math.min(start, end));
    const to = Math.max(from, Math.min(text.length, Math.max(start, end)));
    if (from === to) return { doc: this, nextMode: mode };

    const nextText = `${text.slice(0, from)}${text.slice(to)}`;
    const nextLines = normalizeLines(nextText);
    const nextBuffer = new EditorBuffer(nextLines);
    const pos = nextBuffer.positionAt(from);
    const nextCursor = new EditorCursor(pos.row, pos.col).clamp(nextBuffer.lineCount(), nextBuffer.lineAt(pos.row), mode === 'insert');
    
    return {
      doc: new EditorDocument(nextBuffer, nextCursor),
      nextRegister: { kind: registerKind, text: text.slice(from, to) },
      nextMode: mode,
    };
  }

  private newline(): EditorDocument {
     const line = this.buffer.lineAt(this.cursor.row);
     const before = line.slice(0, this.cursor.col);
     const after = line.slice(this.cursor.col);
     return this.with({
       buffer: this.buffer.deleteLine(this.cursor.row).insertLine(this.cursor.row, before).insertLine(this.cursor.row + 1, after),
       cursor: new EditorCursor(this.cursor.row + 1, 0),
     });
  }

  private backspace(): EditorDocument {
    if (this.cursor.col > 0) {
      const line = this.buffer.lineAt(this.cursor.row);
      const nextLine = `${line.slice(0, this.cursor.col - 1)}${line.slice(this.cursor.col)}`;
      return this.with({
        buffer: this.buffer.replaceLine(this.cursor.row, nextLine),
        cursor: new EditorCursor(this.cursor.row, this.cursor.col - 1),
      });
    }
    if (this.cursor.row === 0) return this;
    const prevLine = this.buffer.lineAt(this.cursor.row - 1);
    const currentLine = this.buffer.lineAt(this.cursor.row);
    return this.with({
      buffer: this.buffer.deleteLine(this.cursor.row).replaceLine(this.cursor.row - 1, `${prevLine}${currentLine}`),
      cursor: new EditorCursor(this.cursor.row - 1, prevLine.length),
    });
  }

  private yank(target: 'line' | 'to-end'): RegisterState {
     if (target === 'line') {
       return { kind: 'line', text: this.buffer.lineAt(this.cursor.row) };
     }
     return { kind: 'char', text: this.buffer.lineAt(this.cursor.row).slice(this.cursor.col) };
  }

  private paste(placement: 'after' | 'before', register: RegisterState | undefined): EditorDocument {
    if (register == null || register.text.length === 0) return this;

    if (register.kind === 'line') {
      const index = placement === 'before' ? this.cursor.row : this.cursor.row + 1;
      const inserted = register.text.split('\n');
      let nextBuffer = this.buffer;
      for (let i = 0; i < inserted.length; i++) {
        nextBuffer = nextBuffer.insertLine(index + i, inserted[i] ?? '');
      }
      return this.with({
        buffer: nextBuffer,
        cursor: new EditorCursor(index, 0),
      });
    }

    const insertionIndex = placement === 'before'
      ? this.buffer.textIndex(this.cursor.row, this.cursor.col)
      : this.buffer.textIndex(this.cursor.row, this.cursor.col) + (this.buffer.lineAt(this.cursor.row).length === 0 ? 0 : 1);
    const text = this.buffer.text();
    const nextText = `${text.slice(0, insertionIndex)}${register.text}${text.slice(insertionIndex)}`;
    const nextLines = normalizeLines(nextText);
    const nextBuffer = new EditorBuffer(nextLines);
    const pos = nextBuffer.positionAt(insertionIndex + register.text.length - 1);
    return new EditorDocument(nextBuffer, new EditorCursor(pos.row, pos.col).clamp(nextBuffer.lineCount(), nextBuffer.lineAt(pos.row), false));
  }
}
