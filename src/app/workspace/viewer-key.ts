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
import { WorkspaceMessageTypes, workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import { ViewModes } from './view-mode.js';
import {
  createWorkspaceTextEditCmd,
  createWorkspaceTextReadCmd,
  defaultWorkspaceTextAperture,
  WorkspaceTextEditCommandKinds,
} from './workspace-text-commands.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import {
  planWorkspaceTextBackspace,
  planWorkspaceTextDeleteUnderCursor,
  planWorkspaceTextInsert,
  WorkspaceTextEditPlanKinds,
  type WorkspaceTextDeletePlan,
  type WorkspaceTextInsertPlan,
} from './workspace-text-edit-planner.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';

const INSERT_TAB_TEXT = '  ';
const INSERT_NEWLINE_TEXT = '\n';
const UNSUPPORTED_PRODUCTION_EDIT_TITLE = 'Unsupported production text command';
const UNSUPPORTED_UNDO_MESSAGE = 'Undo must be submitted as explicit causal input before production use.';
const UNSUPPORTED_REDO_MESSAGE = 'Redo must be submitted as explicit causal input before production use.';

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
  return productionNormalModeEdit(msg, model, productionTextSession, editor);
}

function productionNormalModeEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  editor: NonNullable<WorkspaceModel['editor']>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const unsupported = unsupportedProductionHistoryEdit(msg, model);
  if (unsupported != null) {
    return unsupported;
  }
  const deleteEdit = normalModeDeleteEdit(msg, model, productionTextSession);
  if (deleteEdit != null) {
    return deleteEdit;
  }
  return productionNormalModeNavigation(msg, model, productionTextSession, editor);
}

function normalModeDeleteEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  return msg.key === EditorKeys.X && !msg.ctrl && !msg.alt
    ? productionDeleteUnderCursor(model, productionTextSession)
    : undefined;
}

function productionNormalModeNavigation(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  editor: NonNullable<WorkspaceModel['editor']>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const viewport = editorViewport(model);
  const moved = updateNormalMode(editor, msg, viewport.width, viewport.height);
  if (moved.lines !== editor.lines) {
    return [model, []];
  }
  return moved !== editor
    ? updateProductionTextView(model, productionTextSession, moved)
    : undefined;
}

function productionInsertModeEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  return productionInsertMutation(msg, model, productionTextSession)
    ?? productionInsertNavigation(msg, model, productionTextSession);
}

function productionInsertMutation(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const insertText = insertTextFromKey(msg);
  if (insertText != null) {
    return productionInsertText(model, productionTextSession, insertText);
  }
  if (msg.key === EditorKeys.Backspace) {
    return productionBackspace(model, productionTextSession);
  }
  return msg.key === EditorKeys.Delete
    ? productionDeleteUnderCursor(model, productionTextSession)
    : undefined;
}

function productionInsertText(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  insertText: string,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  return queueProductionTextPlan(model, productionTextSession, planWorkspaceTextInsert(editor, insertText));
}

function productionInsertNavigation(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
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
  return moved !== editor
    ? updateProductionTextView(model, productionTextSession, moved)
    : undefined;
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
  const plan = planWorkspaceTextBackspace(editor);
  return plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [model, []]
    : queueProductionTextPlan(model, productionTextSession, plan);
}

function productionDeleteUnderCursor(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const plan = planWorkspaceTextDeleteUnderCursor(editor);
  return plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [model, []]
    : queueProductionTextPlan(model, productionTextSession, plan);
}

function queueProductionTextPlan(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  plan: WorkspaceTextInsertPlan | WorkspaceTextDeletePlan,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  return plan.kind === WorkspaceTextEditPlanKinds.Insert
    ? queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Insert,
      startByte: plan.startByte,
      insertText: plan.insertText,
    })
    : queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Delete,
      startByte: plan.startByte,
      endByte: plan.endByte,
    });
}

function unsupportedProductionHistoryEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  if (!isUnsupportedProductionHistoryKey(msg)) {
    return undefined;
  }
  const message = msg.key === EditorKeys.U ? UNSUPPORTED_UNDO_MESSAGE : UNSUPPORTED_REDO_MESSAGE;
  return [model, [() => ({
    type: WorkspaceMessageTypes.RuntimeIssue,
    issue: {
      name: 'UnsupportedProductionTextHistoryCommand',
      title: UNSUPPORTED_PRODUCTION_EDIT_TITLE,
      message,
      level: RuntimeIssueLevels.Error,
      source: RuntimeIssueSources.Command,
      atMs: model.time,
    },
  })]];
}

function isUnsupportedProductionHistoryKey(msg: KeyMsg): boolean {
  return (msg.key === EditorKeys.U && !msg.ctrl && !msg.alt)
    || (msg.key === EditorKeys.R && msg.ctrl && !msg.alt);
}

function queueProductionTextEdit(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  edit: ProductionTextEditRequest,
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

type ProductionTextEditRequest =
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Insert;
    readonly startByte: number;
    readonly insertText: string;
  }
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Delete;
    readonly startByte: number;
    readonly endByte: number;
  };

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
