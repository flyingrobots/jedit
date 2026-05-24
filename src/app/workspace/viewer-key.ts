import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { hasFocusablePeers } from '../../ui/panel-focus.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { ProductionTextSession } from './production-text-session.js';
import {
  beginSourceHighlightRefresh,
  shouldRefreshSourceHighlight,
} from '../source-highlight-session.js';
import {
  editorViewport,
  scrollPreview,
  updateInsertMode,
  updateNormalMode,
} from './editor-session.js';
import { EditorModes } from './editor/mode.js';
import { EditorKeys } from './editor/key.js';
import { focusCycleState } from './focus.js';
import type { WorkspaceModel } from './model.js';
import { workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import { ViewModes } from './view-mode.js';
import {
  createWorkspaceTextEditCmd,
  createWorkspaceTextReadCmd,
  defaultWorkspaceTextAperture,
  WorkspaceTextEditCommandKinds,
} from './workspace-text-commands.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import { byteOffsetForTextPosition, nextByteOffset, previousByteOffset } from './workspace-text-position.js';

const INSERT_TAB_TEXT = '  ';
const INSERT_NEWLINE_TEXT = '\n';

export function updateViewerFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null) {
    return [model, []];
  }

  const viewport = editorViewport(model);
  if (model.viewMode === ViewModes.Preview) {
    return [{
      ...model,
      editor: scrollPreview(model.editor, msg, viewport.height),
    }, []];
  }

  const productionEdit = updateProductionTextEditFromKey(msg, model, productionTextSession);
  if (productionEdit != null) {
    return productionEdit;
  }

  const canTabIndent = !hasFocusablePeers(focusCycleState(model));
  const editor = model.editor.mode === EditorModes.Insert
    ? updateInsertMode(model.editor, msg, {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      allowTabIndent: canTabIndent,
    })
    : updateNormalMode(model.editor, msg, viewport.width, viewport.height);

  const next: WorkspaceModel = {
    ...model,
    editor,
  };

  return shouldRefreshSourceHighlight(model.editor, editor)
    ? beginSourceHighlightRefresh(next, editor, viewport, sourceHighlighter, workspaceSourceHighlightMessage)
    : [next, []];
}

function updateProductionTextEditFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened || model.editor == null) {
    return undefined;
  }
  const editor = model.editor;
  if (editor.mode === EditorModes.Insert) {
    return productionInsertModeEdit(msg, model, productionTextSession);
  }
  if (msg.key === EditorKeys.X && !msg.ctrl && !msg.alt) {
    return productionDeleteUnderCursor(model, productionTextSession);
  }
  const viewport = editorViewport(model);
  const moved = updateNormalMode(editor, msg, viewport.width, viewport.height);
  if (moved.lines !== editor.lines) {
    return [model, []];
  }
  if (moved !== editor) {
    return updateProductionTextView(model, productionTextSession, moved);
  }
  return undefined;
}

function productionInsertModeEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const insertText = insertTextFromKey(msg);
  if (insertText == null) {
    if (msg.key === EditorKeys.Backspace) {
      return productionBackspace(model, productionTextSession);
    }
    if (msg.key === EditorKeys.Delete) {
      return productionDeleteUnderCursor(model, productionTextSession);
    }
    const viewport = editorViewport(model);
    const moved = updateInsertMode(editor, msg, {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      allowTabIndent: !hasFocusablePeers(focusCycleState(model)),
    });
    if (moved.lines !== editor.lines) {
      return [model, []];
    }
    if (moved !== editor) {
      return updateProductionTextView(model, productionTextSession, moved);
    }
    return undefined;
  }
  const startByte = byteOffsetForTextPosition(editor.lines, {
    row: editor.cursorRow,
    column: editor.cursorCol,
  });
  return queueProductionTextEdit(model, productionTextSession, {
    kind: WorkspaceTextEditCommandKinds.Insert,
    startByte,
    insertText,
  });
}

function updateProductionTextView(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  editor: NonNullable<WorkspaceModel['editor']>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const nextModel = {
    ...model,
    editor,
  };
  if (
    model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened
    || editor.scrollRow === model.editor?.scrollRow
  ) {
    return [nextModel, []];
  }
  const requestId = model.textRequestId + 1;
  return [{
    ...nextModel,
    textRequestId: requestId,
  }, [
    createWorkspaceTextReadCmd({
      requestId,
      filePath: model.textAuthority.filePath,
      bufferId: model.textAuthority.bufferId,
      productionTextSession,
      atMs: model.time,
      aperture: defaultWorkspaceTextAperture(),
    }),
  ]];
}

function productionBackspace(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const endByte = byteOffsetForTextPosition(editor.lines, {
    row: editor.cursorRow,
    column: editor.cursorCol,
  });
  const startByte = previousByteOffset(editor.lines, {
    row: editor.cursorRow,
    column: editor.cursorCol,
  });
  return startByte === endByte
    ? [model, []]
    : queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Delete,
      startByte,
      endByte,
    });
}

function productionDeleteUnderCursor(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const startByte = byteOffsetForTextPosition(editor.lines, {
    row: editor.cursorRow,
    column: editor.cursorCol,
  });
  const endByte = nextByteOffset(editor.lines, {
    row: editor.cursorRow,
    column: editor.cursorCol,
  });
  return startByte === endByte
    ? [model, []]
    : queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Delete,
      startByte,
      endByte,
    });
}

function queueProductionTextEdit(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  edit: (
    | { readonly kind: typeof WorkspaceTextEditCommandKinds.Insert; readonly startByte: number; readonly insertText: string }
    | { readonly kind: typeof WorkspaceTextEditCommandKinds.Delete; readonly startByte: number; readonly endByte: number }
  ),
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return [model, []];
  }
  const requestId = model.textRequestId + 1;
  const base = {
    requestId,
    filePath: model.textAuthority.filePath,
    bufferId: model.textAuthority.bufferId,
    productionTextSession,
    atMs: model.time,
    aperture: defaultWorkspaceTextAperture(),
  };
  return [{
    ...model,
    textRequestId: requestId,
  }, [
    createWorkspaceTextEditCmd({
      ...base,
      ...edit,
    }),
  ]];
}

function insertTextFromKey(msg: KeyMsg): string | undefined {
  if (msg.ctrl || msg.alt) {
    return undefined;
  }
  if (msg.key === EditorKeys.Enter) {
    return INSERT_NEWLINE_TEXT;
  }
  if (msg.key === EditorKeys.Tab) {
    return INSERT_TAB_TEXT;
  }
  return msg.key.length === 1 ? msg.key : undefined;
}
