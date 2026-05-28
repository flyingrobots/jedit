import type { Cmd } from '@flyingrobots/bijou-tui';
import { joinLines } from './editor-lines.js';
import type { SourceHighlightReading, SourceHighlighter } from '../ports/source-highlighter.js';

export const SOURCE_HIGHLIGHT_MESSAGE = 'source-highlight';

const HEAD_ID_SEPARATOR = '#';

export interface SourceHighlightMsg {
  readonly type: typeof SOURCE_HIGHLIGHT_MESSAGE;
  readonly requestId: number;
  readonly info: SourceHighlightReading;
}

export interface SourceHighlightState {
  readonly sourceHighlight?: SourceHighlightReading;
  readonly sourceHighlightLoading: boolean;
  readonly sourceHighlightRequestId: number;
}

export interface SourceHighlightEditor {
  readonly path: string;
  readonly lines: readonly string[];
  readonly scrollRow: number;
}

export interface SourceHighlightViewport {
  readonly height: number;
}

export type SourceHighlightMessageMapper<M> = (msg: SourceHighlightMsg) => M;

export function beginSourceHighlightRefresh<Model extends SourceHighlightState, M>(
  model: Model,
  editor: SourceHighlightEditor | undefined,
  viewport: SourceHighlightViewport,
  highlighter: SourceHighlighter,
  mapMessage: SourceHighlightMessageMapper<M>,
): [Model, Cmd<M>[]] {
  if (editor == null) {
    return [clearSourceHighlight(model), []];
  }

  const requestId = model.sourceHighlightRequestId + 1;
  return [
    startSourceHighlight(model, requestId),
    [requestSourceHighlightCmd(requestId, editor, viewport, highlighter, mapMessage)],
  ];
}

export function reduceSourceHighlightMsg<Model extends SourceHighlightState>(model: Model, msg: SourceHighlightMsg): Model {
  if (msg.requestId !== model.sourceHighlightRequestId) {
    return model;
  }
  return Object.assign({}, model, {
    sourceHighlight: msg.info,
    sourceHighlightLoading: false,
  });
}

export function shouldRefreshSourceHighlight(previous: SourceHighlightEditor, next: SourceHighlightEditor): boolean {
  return previous.path !== next.path
    || previous.lines !== next.lines
    || previous.scrollRow !== next.scrollRow;
}

function requestSourceHighlightCmd<M>(
  requestId: number,
  editor: SourceHighlightEditor,
  viewport: SourceHighlightViewport,
  highlighter: SourceHighlighter,
  mapMessage: SourceHighlightMessageMapper<M>,
): Cmd<M> {
  return async () => {
    try {
      return mapMessage({
        type: SOURCE_HIGHLIGHT_MESSAGE,
        requestId,
        info: await highlighter.highlight({
          path: editor.path,
          text: joinLines(editor.lines),
          startLine: editor.scrollRow,
          lineCount: viewport.height,
          headId: `${editor.path}${HEAD_ID_SEPARATOR}${String(requestId)}`,
          tick: requestId,
        }),
      });
    } catch (cause) {
      return mapMessage({
        type: SOURCE_HIGHLIGHT_MESSAGE,
        requestId,
        info: {
          path: editor.path,
          partial: false,
          spans: [],
          error: cause instanceof Error ? cause.message : String(cause),
        },
      });
    }
  };
}

function clearSourceHighlight<Model extends SourceHighlightState>(model: Model): Model {
  return Object.assign({}, model, {
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
  });
}

function startSourceHighlight<Model extends SourceHighlightState>(model: Model, requestId: number): Model {
  return Object.assign({}, model, {
    sourceHighlight: undefined,
    sourceHighlightLoading: true,
    sourceHighlightRequestId: requestId,
  });
}
