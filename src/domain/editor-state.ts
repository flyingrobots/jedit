import { EditorBuffer } from './editor-buffer.js';
import { EditorCursor } from './editor-cursor.js';
import { EditorHistory, type HistoryEntry } from './editor-history.js';
import { EditorDocument } from './editor-document.js';

export type ViewMode = 'source' | 'preview';
export type EditorMode = 'normal' | 'insert';
export type PendingNormal = 'c' | 'd' | 'g' | 'y';
export type RegisterKind = 'char' | 'line';

export interface RegisterState {
  readonly kind: RegisterKind;
  readonly text: string;
}

export interface EditorStateSnapshot {
  readonly path: string;
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly mode: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly register?: RegisterState;
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];
}

export type EditorMotion =
  | { type: 'char'; direction: 'left' | 'right' | 'up' | 'down'; delta?: number }
  | { type: 'word'; target: 'start' | 'prev-start' | 'end' }
  | { type: 'line'; target: 'start' | 'end' | 'first-non-whitespace' }
  | { type: 'document'; target: 'top' | 'bottom' };

export type EditorMutation =
  | { type: 'insert'; text: string }
  | { type: 'delete'; target: 'char' | 'line' | 'to-end' }
  | { type: 'newline' }
  | { type: 'backspace' }
  | { type: 'paste'; placement: 'after' | 'before' }
  | { type: 'yank'; target: 'line' | 'to-end' };

export class EditorState {
  readonly path: string;
  readonly doc: EditorDocument;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly mode: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly register?: RegisterState;
  readonly history: EditorHistory;

  constructor(snapshot: EditorStateSnapshot) {
    this.path = snapshot.path;
    this.doc = new EditorDocument(
      new EditorBuffer(snapshot.lines),
      new EditorCursor(snapshot.cursorRow, snapshot.cursorCol)
    );
    this.scrollRow = snapshot.scrollRow;
    this.scrollCol = snapshot.scrollCol;
    this.dirty = snapshot.dirty;
    this.readOnly = snapshot.readOnly;
    this.mode = snapshot.mode;
    this.pendingNormal = snapshot.pendingNormal;
    this.register = snapshot.register;
    this.history = new EditorHistory(snapshot.undoStack, snapshot.redoStack);
    Object.freeze(this);
  }

  static from(snapshot: EditorStateSnapshot): EditorState {
    return new EditorState(snapshot);
  }

  get lines(): readonly string[] { return this.doc.buffer.lines; }
  get cursorRow(): number { return this.doc.cursor.row; }
  get cursorCol(): number { return this.doc.cursor.col; }
  get undoStack(): readonly HistoryEntry[] { return this.history.undoStack; }
  get redoStack(): readonly HistoryEntry[] { return this.history.redoStack; }
  get buffer(): EditorBuffer { return this.doc.buffer; }
  get cursor(): EditorCursor { return this.doc.cursor; }

  toSnapshot(): EditorStateSnapshot {
    return {
      path: this.path,
      lines: this.doc.buffer.lines,
      cursorRow: this.doc.cursor.row,
      cursorCol: this.doc.cursor.col,
      scrollRow: this.scrollRow,
      scrollCol: this.scrollCol,
      dirty: this.dirty,
      readOnly: this.readOnly,
      mode: this.mode,
      pendingNormal: this.pendingNormal,
      register: this.register,
      undoStack: this.history.undoStack,
      redoStack: this.history.redoStack,
    };
  }

  with(patch: Partial<EditorStateSnapshot>): EditorState {
    return new EditorState({ ...this.toSnapshot(), ...patch });
  }

  snapshot(): HistoryEntry {
    return {
      lines: [...this.doc.buffer.lines],
      cursorRow: this.doc.cursor.row,
      cursorCol: this.doc.cursor.col,
      scrollRow: this.scrollRow,
      scrollCol: this.scrollCol,
      dirty: this.dirty,
    };
  }

  applyMotion(motion: EditorMotion): EditorState {
    const nextDoc = this.doc.applyMotion(motion, this.mode === 'insert');
    return this.with({
      cursorRow: nextDoc.cursor.row,
      cursorCol: nextDoc.cursor.col,
    });
  }

  applyMutation(mutation: EditorMutation): EditorState {
    if (this.readOnly) return this;
    const result = this.doc.applyMutation(mutation, this.register);
    return this.commitMutation({
      lines: result.doc.buffer.lines,
      cursorRow: result.doc.cursor.row,
      cursorCol: result.doc.cursor.col,
      register: result.nextRegister ?? this.register,
      mode: result.nextMode ?? this.mode,
    });
  }

  undo(): EditorState {
    const popped = this.history.popUndo();
    if (popped == null) return this;
    return this.with({
      ...popped.entry,
      undoStack: popped.next.undoStack,
      redoStack: [...popped.next.redoStack, this.snapshot()],
      mode: 'normal',
    });
  }

  redo(): EditorState {
    const popped = this.history.popRedo();
    if (popped == null) return this;
    return this.with({
      ...popped.entry,
      undoStack: [...popped.next.undoStack, this.snapshot()],
      redoStack: popped.next.redoStack,
      mode: 'normal',
    });
  }

  commitMutation(patch: Partial<EditorStateSnapshot>): EditorState {
    return this.with({
      ...patch,
      undoStack: [...this.history.undoStack, this.snapshot()],
      redoStack: [],
      dirty: patch.dirty ?? true,
      pendingNormal: undefined,
    });
  }

  ensureVisible(width: number, height: number): EditorState {
    const line = this.doc.buffer.lineAt(this.doc.cursor.row);
    const clampedCursor = this.doc.cursor.clamp(this.doc.buffer.lineCount(), line, this.mode === 'insert');
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);

    let scrollRow = this.scrollRow;
    let scrollCol = this.scrollCol;

    if (clampedCursor.row < scrollRow) {
      scrollRow = clampedCursor.row;
    } else if (clampedCursor.row >= scrollRow + safeHeight) {
      scrollRow = clampedCursor.row - safeHeight + 1;
    }

    if (clampedCursor.col < scrollCol) {
      scrollCol = clampedCursor.col;
    } else if (clampedCursor.col >= scrollCol + safeWidth) {
      scrollCol = clampedCursor.col - safeWidth + 1;
    }

    const maxScrollCol = Math.max(0, line.length - safeWidth + 1);

    return this.with({
      cursorRow: clampedCursor.row,
      cursorCol: clampedCursor.col,
      scrollRow: Math.max(0, scrollRow),
      scrollCol: Math.max(0, Math.min(scrollCol, maxScrollCol)),
    });
  }
}
