import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { ProductionTextSession } from './production-text-session.js';
import {
  shouldRefreshSourceHighlight,
  beginWorkspaceSourceHighlightRefresh,
} from './workspace-source-highlight.js';
import {
  editorViewport,
  scrollPreview,
  updateInsertMode,
  updateNormalMode,
} from './editor-session.js';
import {
  isNormalModeHistoryKey,
  plannedWorkspaceCommandEventForQueuedEdit,
} from './workspace-history-commands.js';
import { EditorModes, PendingNormals } from './editor/mode.js';
import { EditorKeys } from './editor/key.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { ViewModes } from './view-mode.js';
import {
  canEditorTabIndent,
  productionInsertEditProposal,
} from './workspace-production-edit-proposal.js';
import {
  createWorkspaceTextEditCmd,
  createWorkspaceTextReadCmd,
  workspaceTextApertureFromEditor,
  WorkspaceTextEditCommandKinds,
} from './workspace-text-commands.js';
import {
  WorkspaceTextAuthorityKinds,
  WorkspaceTextIntentStatuses,
  WorkspaceTextPendingCommandKinds,
  workspaceTextAuthorityWithPendingEdit,
  type WorkspaceTextPendingCommandKind,
} from './workspace-text-authority.js';
import { workspaceCausalGutterBasisHeadId } from './workspace-causal-gutter-basis.js';
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
    ? beginWorkspaceSourceHighlightRefresh(next, viewport, sourceHighlighter)
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
  const normalEdit = productionNormalModeLocalEdit(msg, model, productionTextSession, editor);
  if (normalEdit != null) {
    return normalEdit;
  }
  const deleteEdit = normalModeDeleteEdit(msg, model, productionTextSession);
  if (deleteEdit != null) {
    return deleteEdit;
  }
  return productionNormalModeNavigation(msg, model, productionTextSession, editor);
}

function productionNormalModeLocalEdit(
  msg: KeyMsg,
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  editor: NonNullable<WorkspaceModel['editor']>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  if (isNormalModeHistoryKey(msg)) {
    return [model, []];
  }
  const viewport = editorViewport(model);
  const moved = updateNormalMode(editor, msg, viewport.width, viewport.height);
  if (moved.lines === editor.lines) {
    return undefined;
  }
  if (hasPendingProductionTextProposal(model)) {
    return [model, []];
  }
  const plan = normalModeLinePlan(msg, editor, moved)
    ?? normalModeTransitionPlan(editor, moved);
  return plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [model, []]
    : queueProductionTextPlan(
      model,
      productionTextSession,
      plan,
      {
        pendingCommandKind: WorkspaceTextPendingCommandKinds.Vim,
        commandEventEditor: moved,
      },
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
  const proposal = productionInsertEditProposal(msg, model);
  if (proposal == null) {
    return undefined;
  }
  if (hasPendingProductionTextProposal(model)) {
    return [model, []];
  }
  return proposal.plan.kind === WorkspaceTextEditPlanKinds.Unsupported
    ? [model, []]
    : queueProductionTextPlan(
      model,
      productionTextSession,
      proposal.plan,
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
  const nextModel = { ...model, editor };
  if (
    model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened || model.textAuthority.cache == null
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
      ...model.textAuthority.cache.textBasis,
      productionTextSession,
      atMs: model.time,
      aperture: workspaceTextApertureFromEditor(editor, editorViewport(nextModel).height),
    }),
  ]];
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
    : queueProductionTextPlan(
      model,
      productionTextSession,
      plan,
    );
}

function queueProductionTextPlan(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  plan: WorkspaceTextInsertPlan | WorkspaceTextReplacePlan | WorkspaceTextDeletePlan,
  provenance?: QueuedTextProvenance,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (plan.kind === WorkspaceTextEditPlanKinds.Insert) {
    return queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Insert,
      startByte: plan.startByte,
      insertText: plan.insertText,
      cursorAfter: plan.cursorAfter,
    }, provenance);
  }
  return plan.kind === WorkspaceTextEditPlanKinds.Replace
    ? queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Replace,
      startByte: plan.startByte,
      endByte: plan.endByte,
      insertText: plan.insertText,
      cursorAfter: plan.cursorAfter,
    }, provenance)
    : queueProductionTextEdit(model, productionTextSession, {
      kind: WorkspaceTextEditCommandKinds.Delete,
      startByte: plan.startByte,
      endByte: plan.endByte,
      cursorAfter: plan.cursorAfter,
    }, provenance);
}

function queueProductionTextEdit(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
  edit: ProductionTextEditRequest,
  provenance?: QueuedTextProvenance,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened || model.editor == null) {
    return [model, []];
  }
  const requestId = model.textRequestId + 1;
  const editor = model.editor;
  const queuedModel = model;
  const viewport = editorViewport(queuedModel);
  const textAuthority = textAuthorityForQueuedEdit(model.textAuthority, editor, requestId, provenance);
  const base = {
    requestId,
    filePath: model.textAuthority.filePath,
    bufferId: model.textAuthority.bufferId,
    productionTextSession,
    atMs: model.time,
    aperture: workspaceTextApertureFromEditor(editor, viewport.height),
    changeBasisHeadId: workspaceCausalGutterBasisHeadId(model.causalGutterBasis, model.textAuthority.durability),
  };
  return [{
    ...queuedModel,
    textRequestId: requestId,
    textAuthority,
  }, [
    createWorkspaceTextEditCmd({
      ...base,
      ...(provenance?.pendingCommandKind == null
        ? {}
        : { provenanceKind: provenance.pendingCommandKind }),
      ...edit,
    }),
  ]];
}

function textAuthorityForQueuedEdit(
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
  editor: NonNullable<WorkspaceModel['editor']>,
  requestId: number,
  provenance?: QueuedTextProvenance,
) {
  const pendingCommandKind = provenance?.pendingCommandKind;
  const pendingAuthority = workspaceTextAuthorityWithPendingEdit(authority, requestId, pendingCommandKind);
  const pendingCommandEvent = plannedWorkspaceCommandEventForQueuedEdit({
    editor: provenance?.commandEventEditor ?? editor,
    pendingCommandKind,
    requestId,
    textAuthority: pendingAuthority,
  });
  return workspaceTextAuthorityWithPendingEdit(authority, requestId, pendingCommandKind, pendingCommandEvent);
}

interface QueuedTextProvenance {
  readonly pendingCommandKind?: WorkspaceTextPendingCommandKind;
  readonly commandEventEditor?: NonNullable<WorkspaceModel['editor']>;
}

function hasPendingProductionTextProposal(model: WorkspaceModel): boolean {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return false;
  }
  return model.textAuthority.pendingIntentStatus === WorkspaceTextIntentStatuses.Predicted
    || model.textAuthority.pendingIntentStatus === WorkspaceTextIntentStatuses.Submitted;
}

type ProductionTextEditRequest =
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Insert;
    readonly startByte: WorkspaceTextInsertPlan['startByte'];
    readonly insertText: string;
    readonly cursorAfter: WorkspaceTextInsertPlan['cursorAfter'];
  }
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Replace;
    readonly startByte: WorkspaceTextReplacePlan['startByte'];
    readonly endByte: WorkspaceTextReplacePlan['endByte'];
    readonly insertText: string;
    readonly cursorAfter: WorkspaceTextReplacePlan['cursorAfter'];
  }
  | {
    readonly kind: typeof WorkspaceTextEditCommandKinds.Delete;
    readonly startByte: WorkspaceTextDeletePlan['startByte'];
    readonly endByte: WorkspaceTextDeletePlan['endByte'];
    readonly cursorAfter: WorkspaceTextDeletePlan['cursorAfter'];
  };

type WorkspaceTextNormalPlan =
  | WorkspaceTextReplacePlan
  | WorkspaceTextDeletePlan
  | WorkspaceTextUnsupportedPlan;
