import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';
import { FocusPanes } from '../../ui/panel-focus.js';
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
  type EchoHistoryEntry,
  type EchoHistoryEntryDraft,
} from './echo-history.js';
import {
  editorFromWorkspaceTextCache,
  openedWorkspaceTextAuthority,
  obstructedWorkspaceTextAuthority,
  WorkspaceTextAuthorityKinds,
  workspaceTextAuthorityWithCache,
  workspaceTextAuthorityWithCheckpoint,
  workspaceTextAuthorityWithExport,
  workspaceTextAuthorityWithReceipt,
} from './workspace-text-authority.js';
import { WorkspaceTextResultKinds, type WorkspaceTextOpenedResult } from './workspace-text-results.js';
import type { TextPosition } from './workspace-text-position.js';

export type WorkspaceRuntimeResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

const EMPTY_ECHO_HISTORY: readonly EchoHistoryEntry[] = [];

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
    cache: result.cache,
  });
  return {
    ...model,
    textAuthority,
    editor: editorFromWorkspaceTextCache(textAuthority, model.editor),
    viewMode: ViewModes.Source,
    focusPane: FocusPanes.Editor,
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
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened || msg.requestId !== model.textRequestId) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    return pushRuntimeIssueToast(
      withEchoHistoryEntry(model, obstructedHistoryEntry(EchoHistoryEntryKinds.Edit, msg.result.filePath, msg.result.issue)),
      msg.result.issue,
      deps.createNotificationTickCmd,
    );
  }
  const withCache = workspaceTextAuthorityWithCache(
    workspaceTextAuthorityWithReceipt(authority, msg.result.receiptId),
    msg.result.cache,
  );
  return refreshAfterEdit(deps, withEchoHistoryEntry({
    ...model,
    textAuthority: withCache,
    editor: editorAfterTextEdit(model, withCache, msg.result.cursorAfter),
  }, {
    kind: EchoHistoryEntryKinds.Edit,
    status: EchoHistoryEntryStatuses.Applied,
    evidenceId: msg.result.receiptId,
    summary: msg.result.filePath,
  }));
}

function editorAfterTextEdit(
  model: WorkspaceModel,
  authority: Extract<WorkspaceModel['textAuthority'], { kind: typeof WorkspaceTextAuthorityKinds.Opened }>,
  cursorAfter: TextPosition | undefined,
) {
  const editor = editorFromWorkspaceTextCache(authority, model.editor);
  if (cursorAfter == null) {
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
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened || msg.requestId !== model.textRequestId) {
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
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened || msg.requestId !== model.textRequestId) {
    return [model, []];
  }
  if (msg.result.kind === WorkspaceTextResultKinds.Obstructed) {
    return pushRuntimeIssueToast(
      withEchoHistoryEntry(model, obstructedHistoryEntry(EchoHistoryEntryKinds.Export, msg.result.filePath, msg.result.issue)),
      msg.result.issue,
      deps.createNotificationTickCmd,
    );
  }
  const textAuthority = workspaceTextAuthorityWithExport(authority, msg.result.readingId);
  return [withEchoHistoryEntry(withTextAuthority(model, textAuthority), {
    kind: EchoHistoryEntryKinds.Export,
    status: EchoHistoryEntryStatuses.Exported,
    evidenceId: msg.result.readingId,
    summary: msg.result.filePath,
  }), []];
}

function applyTextReadResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.TextReadResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const authority = model.textAuthority;
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened || msg.requestId !== model.textRequestId) {
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
  return {
    ...model,
    textAuthority,
    editor: editorFromWorkspaceTextCache(textAuthority, model.editor),
  };
}

function withEchoHistoryEntry(model: WorkspaceModel, draft: EchoHistoryEntryDraft): WorkspaceModel {
  const echoHistory = appendEchoHistoryEntry(model.echoHistory ?? EMPTY_ECHO_HISTORY, draft);
  const sequence = echoHistory.at(-1)?.sequence ?? EMPTY_ECHO_HISTORY.length;
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
