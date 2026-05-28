import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';
import { FocusPanes } from '../../ui/panel-focus.js';
import { pushRuntimeIssueToast } from '../../ui/feedback.js';
import { beginEditorProjectionRefresh } from './editor-session.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { WorkspaceRuntimeDependencies } from './workspace-runtime-dependencies.js';
import { ViewModes } from './view-mode.js';
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

export type WorkspaceRuntimeResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

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
    return pushRuntimeIssueToast(model, msg.result.issue, deps.createNotificationTickCmd);
  }
  const withCache = workspaceTextAuthorityWithCache(
    workspaceTextAuthorityWithReceipt(authority, msg.result.receiptId),
    msg.result.cache,
  );
  return refreshAfterEdit(deps, {
    ...model,
    textAuthority: withCache,
    editor: editorFromWorkspaceTextCache(withCache, model.editor),
  });
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
    return pushRuntimeIssueToast(model, msg.result.issue, deps.createNotificationTickCmd);
  }
  const textAuthority = workspaceTextAuthorityWithCheckpoint(authority, msg.result.checkpointId);
  return [withTextAuthority(model, textAuthority), []];
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
    return pushRuntimeIssueToast(model, msg.result.issue, deps.createNotificationTickCmd);
  }
  const textAuthority = workspaceTextAuthorityWithExport(authority, msg.result.readingId);
  return [withTextAuthority(model, textAuthority), []];
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
    return pushRuntimeIssueToast(model, msg.result.issue, deps.createNotificationTickCmd);
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

function shouldRefreshGraftAfterTextChange(model: WorkspaceModel): boolean {
  return model.graftDrawerOpen || model.graftInfo?.path === model.editor?.path;
}
