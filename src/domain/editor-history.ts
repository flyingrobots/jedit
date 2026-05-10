export interface HistoryEntry {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
}

export class EditorHistory {
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];

  constructor(undoStack: readonly HistoryEntry[], redoStack: readonly HistoryEntry[]) {
    this.undoStack = undoStack;
    this.redoStack = redoStack;
    Object.freeze(this);
  }

  static empty(): EditorHistory {
    return new EditorHistory([], []);
  }

  push(entry: HistoryEntry): EditorHistory {
    return new EditorHistory([...this.undoStack, entry], []);
  }

  popUndo(): { entry: HistoryEntry; next: EditorHistory } | undefined {
    const entry = this.undoStack.at(-1);
    if (entry == null) return undefined;
    return {
      entry,
      next: new EditorHistory(this.undoStack.slice(0, -1), this.redoStack),
    };
  }

  pushRedo(entry: HistoryEntry): EditorHistory {
    return new EditorHistory(this.undoStack, [...this.redoStack, entry]);
  }

  popRedo(): { entry: HistoryEntry; next: EditorHistory } | undefined {
    const entry = this.redoStack.at(-1);
    if (entry == null) return undefined;
    return {
      entry,
      next: new EditorHistory(this.undoStack, this.redoStack.slice(0, -1)),
    };
  }
}
