import type { Surface, Theme } from '@flyingrobots/bijou';
import type { SourceHighlightReading } from '../ports/source-highlighter.js';
import { createSourceWindowReadingFromLines } from './source-window.js';
import { paintHighlightedSourceWindow } from './source-highlight.js';

const NORMAL_MODE = 'normal';
const INSERT_MODE = 'insert';

export type SourceViewerMode = typeof NORMAL_MODE | typeof INSERT_MODE;

export interface SourceViewerEditor {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly mode: SourceViewerMode;
}

export interface SourceViewerViewport {
  readonly width: number;
  readonly height: number;
}

export interface SourceViewerOptions {
  readonly viewport: SourceViewerViewport;
  readonly leftPad: number;
  readonly topPad: number;
  readonly theme: Theme;
}

export function renderSourceViewer(
  surface: Surface,
  editor: SourceViewerEditor,
  highlight: SourceHighlightReading | undefined,
  options: SourceViewerOptions,
): Surface {
  const sourceWindow = createSourceWindowReadingFromLines({
    lines: editor.lines,
    startLine: editor.scrollRow,
    lineCount: options.viewport.height,
  });
  paintHighlightedSourceWindow(surface, sourceWindow, highlight, {
    x: options.leftPad,
    y: options.topPad,
    scrollCol: editor.scrollCol,
    width: options.viewport.width,
    height: options.viewport.height,
    theme: options.theme,
  });

  const cursor = cursorDisplayPosition(editor);
  const cursorY = options.topPad + (cursor.row - editor.scrollRow);
  const cursorX = options.leftPad + (cursor.col - editor.scrollCol);
  if (
    cursorY >= options.topPad
    && cursorY < options.topPad + options.viewport.height
    && cursorX >= options.leftPad
    && cursorX < options.leftPad + options.viewport.width
  ) {
    const cell = surface.get(cursorX, cursorY);
    surface.set(cursorX, cursorY, {
      ...cell,
      char: cell.char.length > 0 ? cell.char : cursorFallbackChar(editor.mode),
      modifiers: editor.mode === NORMAL_MODE ? ['inverse'] : ['underline'],
      empty: false,
    });
  }

  return surface;
}

function cursorDisplayPosition(editor: SourceViewerEditor): { readonly row: number; readonly col: number } {
  if (editor.mode === INSERT_MODE) {
    return {
      row: editor.cursorRow,
      col: editor.cursorCol,
    };
  }

  const line = editor.lines[editor.cursorRow] ?? '';
  return {
    row: editor.cursorRow,
    col: line.length === 0 ? 0 : Math.min(editor.cursorCol, line.length - 1),
  };
}

function cursorFallbackChar(mode: SourceViewerMode): string {
  return mode === NORMAL_MODE ? ' ' : '│';
}
