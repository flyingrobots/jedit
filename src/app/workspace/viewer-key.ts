import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { ProductionTextSession } from './production-text-session.js';
import type { WorkspaceTextOperationSequencer } from './workspace-text-operation-sequencer.js';
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
import {
  isHistoryPendingCommandKind,
  isNormalModeHistoryKey,
  pendingCommandKindForNormalModeKey,
  plannedWorkspaceCommandEventForQueuedEdit,
} from './workspace-history-commands.js';
import { snapshotEditor } from './editor-editing-core.js';
import { EditorModes, PendingNormals } from './editor/mode.js';
import { EditorKeys } from './editor/key.js';
import type { WorkspaceModel } from './model.js';
import { workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import { ViewModes } from './view-mode.js';
import {
  canEditorTabIndent,
  optimisticProductionInsertMutation,
} from './workspace-production-optimistic-edit.js';
import {
  createWorkspaceTextEditCmd,
  createWorkspaceTextReadCmd,
  workspaceTextApertureFromEditor,
  WorkspaceTextEditCommandKinds,
} from './workspace-text-commands.js';
import {
  WorkspaceTextAuthorityKinds,
  workspaceTextAuthorityWithPendingEdit,
  type WorkspaceTextPendingCommandKind,
} from './workspace-text-authority.js';
import {
  planWorkspaceTextDeleteLine,
  planWorkspaceTextDeleteTransition,
  planWorkspaceTextDeleteUnderCursor,
  planWorkspaceTextReplaceLine,
  planWorkspaceTextReplaceTransition,
  WorkspaceTextEditPlanKinds,
  type WorkspaceTextDeletePlan,
  type WorkspaceTextInsertPlan,
  type WorkspaceTextReplacePlan,
  type WorkspaceTextUnsupportedPlan,
} from './workspace-text-edit-planner.js';

export function updateViewerFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
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

  const productionEdit = updateProductionTextEditFromKey(msg, model, productionTextSession, textOperationSequencer);
  if (productionEdit != null) {
    return productionEdit;
  }

  const canTabIndent = canEditorTabIndent(model);
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
  textOperationSequencer: WorkspaceTextOperationSequencer,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened || model.editor == null) {
    return undefined;
  }
  const editor = model.editor;
  if (editor.mode === EditorModes.Insert) {
    return productionInsertModeEdit(msg, model, productionTextSession, textOperationSequencer);
  }
  return productionNormalModeEdit(msg, model, productionTextSession, textOperationSequencer, editor);
}

function productionNormalModeEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
  editor: NonNullable<WorkspaceModel['editor']>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const normalEdit = productionNormalModeLocalEdit(msg, model, productionTextSession, textOperationSequencer, editor);
  if (normalEdit != null) {
    return normalEdit;
  }
  const deleteEdit = normalModeDeleteEdit(msg, model, productionTextSession, textOperationSequencer);
  if (deleteEdit != null) {
    return deleteEdit;
  }
  return productionNormalModeNavigation(msg, model, productionTextSession, editor);
}

function productionNormalModeLocalEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
  editor: NonNullable<WorkspaceModel['editor']>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const viewport = editorViewport(model);
  const moved = updateNormalMode(editor, msg, viewport.width, viewport.height);
  if (moved.lines === editor.lines) {
    return undefined;
  }
  const plan = normalModeHistoryPlan(msg, editor, moved)
    ?? normalModeLinePlan(msg, editor, moved)
    ?? normalModeTransitionPlan(editor, moved);
  return plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [model, []]
    : queueProductionTextPlan(
      modelWithQueuedNormalEdit(model, moved),
      productionTextSession,
      textOperationSequencer,
      plan,
      pendingCommandKindForNormalModeKey(msg),
    );
}

function normalModeLinePlan(
  msg: KeyMsg,
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
): WorkspaceTextNormalPlan | undefined {
  if (msg.ctrl || msg.alt || msg.shift) {
    return undefined;
  }
  if (editor.pendingNormal === PendingNormals.Delete && msg.key === EditorKeys.D) {
    return planWorkspaceTextDeleteLine(editor, moved);
  }
  return editor.pendingNormal === PendingNormals.Change && msg.key === EditorKeys.C
    ? planWorkspaceTextReplaceLine(editor, moved)
    : undefined;
}

function normalModeTransitionPlan(
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
): WorkspaceTextNormalPlan {
  return moved.mode === EditorModes.Insert
    ? planWorkspaceTextReplaceTransition(editor, moved)
    : planWorkspaceTextDeleteTransition(editor, moved);
}

function modelWithQueuedNormalEdit(
  model: WorkspaceModel,
  moved: NonNullable<WorkspaceModel['editor']>,
): WorkspaceModel {
  const editor = model.editor;
  if (editor == null) {
    return model;
  }
  return {
    ...model,
    editor: {
      ...editor,
      lines: moved.lines,
      cursorRow: moved.cursorRow,
      cursorCol: moved.cursorCol,
      scrollRow: moved.scrollRow,
      scrollCol: moved.scrollCol,
      dirty: moved.dirty,
      mode: moved.mode,
      pendingNormal: moved.pendingNormal,
      pendingVimKeys: moved.pendingVimKeys,
      register: moved.register,
      registers: moved.registers,
      lastVimEdit: moved.lastVimEdit,
      marks: moved.marks,
      lastSearch: moved.lastSearch,
      undoStack: moved.undoStack,
      redoStack: moved.redoStack,
    },
  };
}

function modelWithProductionUndoSnapshot(model: WorkspaceModel): WorkspaceModel {
  const editor = model.editor;
  if (editor == null) {
    return model;
  }
  return {
    ...model,
    editor: {
      ...editor,
      undoStack: [...editor.undoStack, snapshotEditor(editor)],
      redoStack: [],
    },
  };
}

function normalModeHistoryPlan(
  msg: KeyMsg,
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
): WorkspaceTextNormalPlan | undefined {
  return isNormalModeHistoryKey(msg)
    ? planWorkspaceTextReplaceTransition(editor, moved)
    : undefined;
}

function normalModeDeleteEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  return msg.key === EditorKeys.X && !msg.ctrl && !msg.alt
    ? productionDeleteUnderCursor(model, productionTextSession, textOperationSequencer)
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
  textOperationSequencer: WorkspaceTextOperationSequencer,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  return productionInsertMutation(msg, model, productionTextSession, textOperationSequencer)
    ?? productionInsertNavigation(msg, model, productionTextSession);
}

function productionInsertMutation(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const mutation = optimisticProductionInsertMutation(msg, model);
  if (mutation == null) {
    return undefined;
  }
  return mutation.plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [mutation.model, []]
    : queueProductionTextPlan(
      mutation.model,
      productionTextSession,
      textOperationSequencer,
      mutation.plan,
    );
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
    allowTabIndent: canEditorTabIndent(model),
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
      aperture: workspaceTextApertureFromEditor(editor, editorViewport(nextModel).height),
    }),
  ]];
}

function productionDeleteUnderCursor(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const plan = planWorkspaceTextDeleteUnderCursor(editor);
  return plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [model, []]
    : queueProductionTextPlan(
      modelWithProductionUndoSnapshot(model),
      productionTextSession,
      textOperationSequencer,
      plan,
    );
}

function queueProductionTextPlan(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
  plan: WorkspaceTextInsertPlan | WorkspaceTextReplacePlan | WorkspaceTextDeletePlan,
  pendingCommandKind?: WorkspaceTextPendingCommandKind,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (plan.kind === WorkspaceTextEditPlanKinds.Insert) {
    return queueProductionTextEdit(model, productionTextSession, textOperationSequencer, {
      kind: WorkspaceTextEditCommandKinds.Insert,
      startByte: plan.startByte,
      insertText: plan.insertText,
      cursorAfter: plan.cursorAfter,
    }, pendingCommandKind);
  }
  return plan.kind === WorkspaceTextEditPlanKinds.Replace
    ? queueProductionTextEdit(model, productionTextSession, textOperationSequencer, {
      kind: WorkspaceTextEditCommandKinds.Replace,
      startByte: plan.startByte,
      endByte: plan.endByte,
      insertText: plan.insertText,
      cursorAfter: plan.cursorAfter,
    }, pendingCommandKind)
    : queueProductionTextEdit(model, productionTextSession, textOperationSequencer, {
      kind: WorkspaceTextEditCommandKinds.Delete,
      startByte: plan.startByte,
      endByte: plan.endByte,
      cursorAfter: plan.cursorAfter,
    }, pendingCommandKind);
}

function queueProductionTextEdit(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  textOperationSequencer: WorkspaceTextOperationSequencer,
  edit: ProductionTextEditRequest,
  pendingCommandKind?: WorkspaceTextPendingCommandKind,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened || model.editor == null) {
    return [model, []];
  }
  const requestId = model.textRequestId + 1;
  const viewport = editorViewport(model);
  const base = {
    requestId,
    filePath: model.textAuthority.filePath,
    bufferId: model.textAuthority.bufferId,
    productionTextSession,
    textOperationSequencer,
    atMs: model.time,
    aperture: workspaceTextApertureFromEditor(model.editor, viewport.height),
  };
  return [{
    ...model,
    textRequestId: requestId,
    textAuthority: textAuthorityForQueuedEdit(model.textAuthority, model.editor, requestId, pendingCommandKind),
  }, [
    createWorkspaceTextEditCmd({
      ...base,
      ...(isHistoryPendingCommandKind(pendingCommandKind) ? { provenanceKind: pendingCommandKind } : {}),
      ...edit,
    }),
  ]];
}

function textAuthorityForQueuedEdit(
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
  editor: NonNullable<WorkspaceModel['editor']>,
  requestId: number,
  pendingCommandKind?: WorkspaceTextPendingCommandKind,
) {
  const pendingAuthority = workspaceTextAuthorityWithPendingEdit(authority, requestId, pendingCommandKind);
  const pendingCommandEvent = plannedWorkspaceCommandEventForQueuedEdit({
    editor,
    pendingCommandKind,
    requestId,
    textAuthority: pendingAuthority,
  });
  return workspaceTextAuthorityWithPendingEdit(authority, requestId, pendingCommandKind, pendingCommandEvent);
}

type ProductionTextEditRequest =
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Insert;
    readonly startByte: number;
    readonly insertText: string;
    readonly cursorAfter: WorkspaceTextInsertPlan['cursorAfter'];
  }
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Replace;
    readonly startByte: number;
    readonly endByte: number;
    readonly insertText: string;
    readonly cursorAfter: WorkspaceTextReplacePlan['cursorAfter'];
  }
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Delete;
    readonly startByte: number;
    readonly endByte: number;
    readonly cursorAfter: WorkspaceTextDeletePlan['cursorAfter'];
  };

type WorkspaceTextNormalPlan =
  | WorkspaceTextReplacePlan
  | WorkspaceTextDeletePlan
  | WorkspaceTextUnsupportedPlan;
