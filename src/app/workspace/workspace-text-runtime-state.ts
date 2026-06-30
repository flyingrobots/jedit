import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';
import { pushRuntimeIssueToast } from '../../ui/feedback.js';
import { beginEditorProjectionRefresh, editorViewport, ensureEditorVisible } from './editor-session.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { WorkspaceRuntimeDependencies } from './workspace-runtime-dependencies.js';
import { ViewModes } from './view-mode.js';
import {
  appendEchoHistoryEntry,
  EchoHistoryEntryKinds,
  EchoHistoryEntryStatuses,
  sortedEchoHistoryIndexForSequence,
  type EchoHistoryEntryDraft,
} from './echo-history.js';
import {
  openedWorkspaceTextAuthority,
  obstructedWorkspaceTextAuthority,
  WorkspaceTextAuthorityKinds,
  workspaceTextAuthorityWithCache,
  workspaceTextAuthorityWithBlockedIntent,
  workspaceTextAuthorityWithCheckpoint,
  workspaceTextAuthorityWithExport,
  workspaceTextAuthorityWithObstruction,
} from './workspace-text-authority.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextAppliedResult,
  type WorkspaceTextOpenedResult,
} from './workspace-text-results.js';
import {
  dependentEditBlockedIssue,
  shouldIgnoreTextEditObstruction,
  shouldRecordIntermediateTextEditResult,
  settlementObstructionIssue,
  textCheckpointResultTargetsAuthority,
  textEditResultBlockedByEarlierObstruction,
  textEditResultTargetsAuthority,
  textExportResultTargetsAuthority,
  textReadResultTargetsAuthority,
} from './workspace-text-result-guards.js';
import { createWorkspaceTextCheckpointCmd } from './workspace-text-commands.js';
import {
  editorFromWorkspaceTextLines,
  workspaceModelWithTextAuthorityEditor,
} from './workspace-text-reading-cache.js';
import { JEDIT_WSC_WORKSPACE_STORE_STATUS } from '../../ports/jedit-wsc-workspace-store.js';
import {
  jeditAppliedCommandHistorySummary,
  receivedJeditCommandEventForRequest,
  workspaceTextAuthorityWithAppliedJeditCommandReceipt,
  workspaceTextAuthorityWithCurrentJeditCommandObservation,
} from './command-provenance.js';

export type WorkspaceRuntimeResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

const FOCUS_PANE_EDITOR = 'editor';

interface TextExportCheckpointRequest {
  readonly requestId: number;
  readonly filePath: string;
  readonly bufferId: string;
}

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
    const obstructed = withEchoHistoryEntry({
      ...model,
      textAuthority: obstructedTextAuthority(model, msg.result.filePath, msg.requestId, msg.result.issue),
    }, obstructedHistoryEntry(EchoHistoryEntryKinds.Open, msg.result.filePath, msg.result.issue));
    return pushRuntimeIssueToast(obstructed, msg.result.issue, deps.createNotificationTickCmd);
  }
  return refreshAfterOpen(deps, withEchoHistoryEntry(openedTextModel(model, msg.result), {
    kind: EchoHistoryEntryKinds.Open,
    status: EchoHistoryEntryStatuses.Opened,
    evidenceId: msg.result.cache.readingId,
    summary: msg.result.filePath,
  }));
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
    hostFingerprint: result.hostFingerprint,
    cache: result.cache,
  });
  return {
    ...model,
    textAuthority,
    editor: editorFromWorkspaceTextLines({
      filePath: result.filePath,
      readOnly: result.readOnly,
      dirty: false,
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
  const event = receivedJeditCommandEventForRequest(authority, msg.requestId, msg.result.receiptId);
  const withCache = workspaceTextAuthorityWithCache({
    ...authority,
    pendingReceiptId: msg.result.receiptId,
    lastReceiptId: msg.result.receiptId,
    lastCommandEvent: event ?? authority.lastCommandEvent,
  }, msg.result.cache);
  const withCurrentObservation = workspaceTextAuthorityWithCurrentJeditCommandObservation(withCache);
  const applied = withEchoHistoryEntry({
    ...model,
    textAuthority: withCurrentObservation,
  }, {
    kind: EchoHistoryEntryKinds.Edit,
    status: EchoHistoryEntryStatuses.Applied,
    evidenceId: msg.result.receiptId,
    summary: jeditAppliedCommandHistorySummary(msg.result.filePath, msg.requestId, withCurrentObservation),
  });
  const settlement = persistEditSettlement(deps, msg.result, applied);
  return settlement == null ? [applied, []] : settlement;
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
    workspaceTextAuthorityWithAppliedJeditCommandReceipt(authority, msg.requestId, msg.result.receiptId),
    msg.result.cache,
  );
  const withCurrentObservation = workspaceTextAuthorityWithCurrentJeditCommandObservation(withCache);
  const applied = withEchoHistoryEntry({
    ...model,
    textAuthority: withCurrentObservation,
    editor: editorAfterTextEdit(model, withCurrentObservation, msg.result.cursorAfter),
  }, {
    kind: EchoHistoryEntryKinds.Edit,
    status: EchoHistoryEntryStatuses.Applied,
    evidenceId: msg.result.receiptId,
    summary: jeditAppliedCommandHistorySummary(msg.result.filePath, msg.requestId, withCurrentObservation),
  });
  const [refreshed, refreshCommands] = refreshAfterEdit(deps, applied);
  const settlement = persistEditSettlement(deps, msg.result, refreshed);
  return settlement == null
    ? [refreshed, refreshCommands]
    : [settlement[0], [...refreshCommands, ...settlement[1]]];
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
    withEchoHistoryEntry(obstructed, obstructedHistoryEntry(EchoHistoryEntryKinds.Edit, msg.result.filePath, msg.result.issue)),
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
    withEchoHistoryEntry(blocked, {
      kind: EchoHistoryEntryKinds.Edit,
      status: EchoHistoryEntryStatuses.Blocked,
      summary: issue.message,
    }),
    issue,
    deps.createNotificationTickCmd,
  );
}

function persistEditSettlement(
  deps: WorkspaceRuntimeDependencies,
  result: WorkspaceTextAppliedResult,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (result.wscSettlementEnvelope == null) {
    return undefined;
  }
  const stored = deps.wscWorkspaceStore.writeEnvelope(result.wscSettlementEnvelope);
  if (stored.status !== JEDIT_WSC_WORKSPACE_STORE_STATUS.Obstructed) {
    return undefined;
  }
  const issue = settlementObstructionIssue(result.filePath, stored.obstruction, deps.nowMs());
  return pushRuntimeIssueToast(
    withEchoHistoryEntry(model, obstructedHistoryEntry(EchoHistoryEntryKinds.Edit, result.filePath, issue)),
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
      withEchoHistoryEntry(model, obstructedHistoryEntry(EchoHistoryEntryKinds.Checkpoint, msg.result.filePath, msg.result.issue)),
      msg.result.issue,
      deps.createNotificationTickCmd,
    );
  }
  const textAuthority = workspaceTextAuthorityWithCheckpoint(authority, msg.result.checkpointId);
  return [withEchoHistoryEntry(withTextAuthority(model, textAuthority), {
    kind: EchoHistoryEntryKinds.Checkpoint,
    status: EchoHistoryEntryStatuses.Checkpointed,
    evidenceId: msg.result.checkpointId,
    summary: msg.result.filePath,
  }), []];
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
    const obstructed = withEchoHistoryEntry(
      { ...model, quitAfterSaveRequestId: undefined },
      obstructedHistoryEntry(EchoHistoryEntryKinds.Export, msg.result.filePath, msg.result.issue),
    );
    return pushRuntimeIssueToast(obstructed, msg.result.issue, deps.createNotificationTickCmd);
  }
  const textAuthority = workspaceTextAuthorityWithExport(authority, msg.result.readingId, msg.result.hostFingerprint);
  const exported = withTextAuthority({
    ...model, quitAfterSaveRequestId: undefined, quitConfirmOpen: shouldOpenQuitAfterExport(model, msg.requestId),
  }, textAuthority);
  const history = withEchoHistoryEntry(exported, {
    kind: EchoHistoryEntryKinds.Export, status: EchoHistoryEntryStatuses.Exported, evidenceId: msg.result.readingId, summary: msg.result.filePath,
  });
  const checkpoint = exportCheckpointCommand(deps, { requestId: msg.requestId, filePath: msg.result.filePath, bufferId: msg.result.bufferId });
  return [history, [checkpoint]];
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
      withEchoHistoryEntry(model, obstructedHistoryEntry(EchoHistoryEntryKinds.Read, msg.result.filePath, msg.result.issue)),
      msg.result.issue,
      deps.createNotificationTickCmd,
    );
  }
  return [withEchoHistoryEntry(withTextAuthority(model, workspaceTextAuthorityWithCache(authority, msg.result.cache)), {
    kind: EchoHistoryEntryKinds.Read,
    status: EchoHistoryEntryStatuses.Observed,
    evidenceId: msg.result.cache.readingId,
    summary: msg.result.filePath,
  }), []];
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
  return beginEditorProjectionRefresh(model, { refreshGraft: shouldRefreshGraftAfterTextChange(model) }, deps);
}

function withTextAuthority(
  model: WorkspaceModel,
  textAuthority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
): WorkspaceModel {
  return workspaceModelWithTextAuthorityEditor(model, textAuthority);
}

function withEchoHistoryEntry(model: WorkspaceModel, draft: EchoHistoryEntryDraft): WorkspaceModel {
  const echoHistory = appendEchoHistoryEntry(model.echoHistory, draft);
  const sequence = echoHistory.at(-1)?.sequence ?? 0;
  return {
    ...model,
    echoHistory,
    echoHistorySelectedIndex: sortedEchoHistoryIndexForSequence(echoHistory, sequence),
  };
}

function obstructedHistoryEntry(
  kind: EchoHistoryEntryDraft['kind'],
  filePath: string,
  issue: RuntimeIssue,
): EchoHistoryEntryDraft {
  return {
    kind,
    status: EchoHistoryEntryStatuses.Obstructed,
    summary: `${filePath}: ${issue.message}`,
  };
}

function shouldRefreshGraftAfterTextChange(model: WorkspaceModel): boolean {
  return model.graftDrawerOpen || model.graftInfo?.path === model.editor?.path;
}

function shouldOpenQuitAfterExport(model: WorkspaceModel, requestId: number): boolean {
  return model.quitConfirmOpen || model.quitAfterSaveRequestId === requestId;
}

function exportCheckpointCommand(
  deps: WorkspaceRuntimeDependencies,
  request: TextExportCheckpointRequest,
): Cmd<WorkspaceMsg> {
  return createWorkspaceTextCheckpointCmd({
    requestId: request.requestId,
    filePath: request.filePath,
    bufferId: request.bufferId,
    productionTextSession: deps.productionTextSession,
    textOperationSequencer: deps.textOperationSequencer,
    atMs: deps.nowMs(),
  });
}
