export class EditorCursor {
  readonly row: number;
  readonly col: number;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;
    Object.freeze(this);
  }

  static origin(): EditorCursor {
    return new EditorCursor(0, 0);
  }

  moveTo(row: number, col: number): EditorCursor {
    return new EditorCursor(row, col);
  }

  clamp(lineCount: number, lineContent: string, isInsert: boolean): EditorCursor {
    const row = Math.max(0, Math.min(this.row, lineCount - 1));
    const maxCol = isInsert ? lineContent.length : Math.max(0, lineContent.length - 1);
    const col = Math.max(0, Math.min(this.col, maxCol));
    return new EditorCursor(row, col);
  }

  moveChar(direction: 'left' | 'right' | 'up' | 'down', lineCount: number, lineContent: string, isInsert: boolean, delta = 1): EditorCursor {
    switch (direction) {
      case 'left':
        if (isInsert && this.col < delta && this.row > 0) return this; // Handled by State
        return new EditorCursor(this.row, Math.max(0, this.col - delta));
      case 'right': {
        const maxCol = isInsert ? lineContent.length : Math.max(0, lineContent.length - 1);
        if (isInsert && this.col >= maxCol && this.row < lineCount - 1) return this; // Handled by State
        return new EditorCursor(this.row, Math.min(maxCol, this.col + delta));
      }
      case 'up':
      case 'down': {
        const nextRow = Math.max(0, Math.min(this.row + (direction === 'up' ? -delta : delta), lineCount - 1));
        return new EditorCursor(nextRow, this.col);
      }
    }
  }
}
