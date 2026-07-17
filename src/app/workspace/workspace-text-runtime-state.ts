import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';
import { pushRuntimeIssueToast } from '../../ui/feedback.js';
import {
  beginEditorProjectionRefresh,
  beginEditorSourceHighlightRefresh,
  editorViewport,
  ensureEditorVisible,
} from './editor-session.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { WorkspaceRuntimeDependencies } from './workspace-runtime-dependencies.js';
import { ViewModes } from './view-mode.js';
import {
  openedWorkspaceTextAuthority,
  obstructedWorkspaceTextAuthority,
  WorkspaceTextAuthorityKinds,
  WorkspaceTextHostBasisKinds,
  workspaceTextAuthorityWithCache,
  workspaceTextAuthorityWithBlockedIntent,
  workspaceTextAuthorityWithCheckpoint,
  workspaceTextAuthorityWithExport,
  workspaceTextAuthorityWithObstruction,
} from './workspace-text-authority.js';
import { WorkspaceTextResultKinds, type WorkspaceTextAppliedResult, type WorkspaceTextOpenedResult } from './workspace-text-results.js';
import {
  dependentEditBlockedIssue,
  shouldIgnoreTextEditObstruction,
  shouldRecordIntermediateTextEditResult,
  textCheckpointResultTargetsAuthority,
  textEditResultBlockedByEarlierObstruction,
  textEditResultTargetsAuthority,
  textExportResultTargetsAuthority,
  textReadResultTargetsAuthority,
} from './workspace-text-result-guards.js';
import { createWorkspaceTextCheckpointCmd } from './workspace-text-commands.js';
import { editorFromWorkspaceTextLines, workspaceModelWithTextAuthorityEditor } from './workspace-text-reading-cache.js';
import {
  receivedJeditCommandEventForRequest,
  workspaceTextAuthorityWithAppliedJeditCommandReceipt,
  workspaceTextAuthorityWithCurrentJeditCommandObservation,
} from './command-provenance.js';
export type WorkspaceRuntimeResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
const FOCUS_PANE_EDITOR = 'editor';
export function applyWorkspaceTextMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.TextOpenResult) {
    return applyTextOpenResult(deps, msg, model);
  }
  if (msg.type === WorkspaceMessageTypes.TextEditResult) {
    return applyTextEditResult(deps, msg, model);
  }
  if (msg.type === WorkspaceMessageTypes.TextCheckpointResult) {
    return applyTextCheckpointResult(deps, msg, model);
  }
  if (msg.type === WorkspaceMessageTypes.TextExportResult) {
    return applyTextExportResult(deps, msg, model);
  }
  return msg.type === WorkspaceMessageTypes.TextReadResult
    ? applyTextReadResult(deps, msg, model)
    : undefined;
}

function applyTextOpenResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextOpenResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  if (
    model.textAuthority.kind !== WorkspaceTextAuthorityKinds.PendingOpen
    || model.textAuthority.requestId !== msg.requestId
  ) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    const obstructed = {
      ...model,
      textAuthority: obstructedTextAuthority(model, msg.result.filePath, msg.requestId, msg.result.issue),
    };
    return pushRuntimeIssueToast(obstructed, msg.result.issue, deps.createNotificationTickCmd);
  }
  return refreshAfterOpen(deps, openedTextModel(model, msg.result));
}

function obstructedTextAuthority(
  model: WorkspaceModel,
  filePath: string,
  requestId: number,
  issue: RuntimeIssue,
) {
  return obstructedWorkspaceTextAuthority(
    model.textRuntimeProfile,
    filePath,
    requestId,
    issue,
  );
}

function openedTextModel(
  model: WorkspaceModel,
  result: WorkspaceTextOpenedResult,
): WorkspaceModel {
  const textAuthority = openedWorkspaceTextAuthority({
    profile: model.textRuntimeProfile,
    filePath: result.filePath,
    bufferId: result.bufferId,
    readOnly: result.readOnly,
    dirty: false,
    materialization: result.materialization,
    hostBasis: result.hostBasis,
    hostAbsenceBasisHeadId: result.hostBasis === WorkspaceTextHostBasisKinds.Missing
      ? result.cache.textBasis.basisHeadId
      : undefined,
    hostFingerprint: result.hostFingerprint,
    cache: result.cache,
  });
  return {
    ...model,
    textAuthority,
    editor: editorFromWorkspaceTextLines({
      filePath: result.filePath,
      readOnly: result.readOnly,
      dirty: textAuthority.dirty,
      lines: result.initialLines,
      existing: model.editor,
    }),
    viewMode: ViewModes.Source,
    focusPane: FOCUS_PANE_EDITOR,
    graftInfo: undefined,
    graftLoading: false,
    graftSelectedIndex: 0,
  };
}

function applyTextEditResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextEditResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const authority = model.textAuthority;
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return [model, []];
  }
  if (!textEditResultTargetsAuthority(authority, msg.result)) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    return shouldIgnoreTextEditObstruction(authority, msg.requestId, model.textRequestId)
      ? [model, []]
      : applyTextEditObstruction(deps, msg, model, authority);
  }
  if (msg.requestId !== model.textRequestId) {
    return shouldRecordIntermediateTextEditResult(authority, msg.requestId, model.textRequestId)
      ? applyIntermediateTextEditResult(deps, msg, model, authority)
      : [model, []];
  }
  if (textEditResultBlockedByEarlierObstruction(authority, msg.requestId)) {
    return applyBlockedDependentTextEdit(deps, msg, model, authority);
  }
  return applyAppliedTextEditResult(deps, msg, model, authority);
}

function applyIntermediateTextEditResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextEditResult }>,
  model: WorkspaceModel,
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
): WorkspaceRuntimeResult {
  if (msg.result.kind !== WorkspaceTextResultKinds.Applied) {
    return [model, []];
  }
  const withCache = workspaceTextAuthorityWithCache(
    textAuthorityWithIntermediateEditReceipt(authority, msg.requestId, msg.result),
    msg.result.cache,
  );
  const withCurrentObservation = workspaceTextAuthorityWithCurrentJeditCommandObservation(withCache);
  const applied = {
    ...model, inlinePanel: undefined,
    textAuthority: withCurrentObservation,
  };
  return refreshAfterEdit(deps, applied);
}

function textAuthorityWithIntermediateEditReceipt(
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
  requestId: number,
  result: WorkspaceTextAppliedResult,
) {
  if (requestId === authority.pendingClientSeq) {
    return workspaceTextAuthorityWithAppliedJeditCommandReceipt(
      authority, requestId, result.receiptId, undefined,
      { causalTransition: result.causalTransition, lineChanges: result.lineChanges },
    );
  }
  const event = receivedJeditCommandEventForRequest(authority, requestId, result.receiptId);
  return {
    ...authority,
    pendingReceiptId: result.receiptId,
    lastReceiptId: result.receiptId,
    lastCommandEvent: event ?? authority.lastCommandEvent,
  };
}

function applyAppliedTextEditResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextEditResult }>,
  model: WorkspaceModel,
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
): WorkspaceRuntimeResult {
  if (msg.result.kind !== WorkspaceTextResultKinds.Applied) {
    return [model, []];
  }
  const withCache = workspaceTextAuthorityWithCache(
    workspaceTextAuthorityWithAppliedJeditCommandReceipt(
      authority, msg.requestId, msg.result.receiptId, undefined,
      { causalTransition: msg.result.causalTransition, lineChanges: msg.result.lineChanges },
    ),
    msg.result.cache,
  );
  const withCurrentObservation = workspaceTextAuthorityWithCurrentJeditCommandObservation(withCache);
  const applied = {
    ...model, inlinePanel: undefined,
    textAuthority: withCurrentObservation,
    editor: editorAfterTextEdit(model, withCurrentObservation, msg.result.cursorAfter),
  };
  return refreshAfterEdit(deps, applied);
}

function applyTextEditObstruction(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextEditResult }>,
  model: WorkspaceModel,
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
): WorkspaceRuntimeResult {
  if (msg.result.kind !== WorkspaceTextResultKinds.Obstructed) {
    return [model, []];
  }
  const obstructed = {
    ...model,
    textAuthority: workspaceTextAuthorityWithObstruction(authority, msg.requestId, msg.result.issue),
  };
  return pushRuntimeIssueToast(
    obstructed,
    msg.result.issue,
    deps.createNotificationTickCmd,
  );
}

function applyBlockedDependentTextEdit(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextEditResult }>,
  model: WorkspaceModel,
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
): WorkspaceRuntimeResult {
  if (msg.result.kind !== WorkspaceTextResultKinds.Applied) {
    return [model, []];
  }
  const issue = dependentEditBlockedIssue(msg.result.filePath, authority.blockedByClientSeq, deps.nowMs());
  const blocked = {
    ...model,
    textAuthority: workspaceTextAuthorityWithBlockedIntent(authority),
  };
  return pushRuntimeIssueToast(
    blocked,
    issue,
    deps.createNotificationTickCmd,
  );
}

function editorAfterTextEdit(
  model: WorkspaceModel,
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
  cursorAfter: WorkspaceTextAppliedResult['cursorAfter'],
) {
  const editor = workspaceModelWithTextAuthorityEditor(model, authority).editor;
  if (editor == null || cursorAfter == null) {
    return editor;
  }
  const viewport = editorViewport(model);
  return ensureEditorVisible({
    ...editor,
    cursorRow: cursorAfter.row,
    cursorCol: cursorAfter.column,
  }, viewport.width, viewport.height);
}

function applyTextCheckpointResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextCheckpointResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const authority = model.textAuthority;
  if (
    authority.kind !== WorkspaceTextAuthorityKinds.Opened ||
    msg.requestId !== model.textRequestId ||
    !textCheckpointResultTargetsAuthority(authority, msg.result)
  ) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    return pushRuntimeIssueToast(
      model,
      msg.result.issue,
      deps.createNotificationTickCmd,
    );
  }
  const textAuthority = workspaceTextAuthorityWithCheckpoint(
    authority,
    msg.result.checkpointId,
    msg.result.basisHeadId,
  );
  return [withTextAuthority(model, textAuthority), []];
}

function applyTextExportResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextExportResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const authority = model.textAuthority;
  if (
    authority.kind !== WorkspaceTextAuthorityKinds.Opened ||
    msg.requestId !== model.textRequestId ||
    !textExportResultTargetsAuthority(authority, msg.result)
  ) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    const obstructed = { ...model, quitAfterSaveRequestId: undefined };
    return pushRuntimeIssueToast(obstructed, msg.result.issue, deps.createNotificationTickCmd);
  }
  const textAuthority = workspaceTextAuthorityWithExport(
    authority, msg.result.readingId, msg.result.basisHeadId, msg.result.hostFingerprint,
  );
  const exported = withTextAuthority({
    ...model, quitAfterSaveRequestId: undefined, quitConfirmOpen: shouldOpenQuitAfterExport(model, msg.requestId),
  }, textAuthority);
  const checkpoint = createWorkspaceTextCheckpointCmd({
    requestId: msg.requestId,
    filePath: msg.result.filePath,
    bufferId: msg.result.bufferId,
    basisHeadId: msg.result.basisHeadId,
    productionTextSession: deps.productionTextSession,
    atMs: deps.nowMs(),
  });
  return [exported, [checkpoint]];
}

function applyTextReadResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextReadResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const authority = model.textAuthority;
  if (
    authority.kind !== WorkspaceTextAuthorityKinds.Opened ||
    msg.requestId !== model.textRequestId ||
    !textReadResultTargetsAuthority(authority, msg.result)
  ) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    return pushRuntimeIssueToast(
      model,
      msg.result.issue,
      deps.createNotificationTickCmd,
    );
  }
  return [withTextAuthority(model, workspaceTextAuthorityWithCache(authority, msg.result.cache)), []];
}

function refreshAfterOpen(
  deps: WorkspaceRuntimeDependencies,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  return beginEditorProjectionRefresh(model, { refreshGraft: model.graftDrawerOpen }, deps);
}

function refreshAfterEdit(
  deps: WorkspaceRuntimeDependencies,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  return beginEditorSourceHighlightRefresh(model, deps);
}

function withTextAuthority(
  model: WorkspaceModel,
  textAuthority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
): WorkspaceModel {
  return workspaceModelWithTextAuthorityEditor(model, textAuthority);
}

function shouldOpenQuitAfterExport(model: WorkspaceModel, requestId: number): boolean {
  return model.quitConfirmOpen || model.quitAfterSaveRequestId === requestId;
}
