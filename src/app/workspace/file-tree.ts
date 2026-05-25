import type { KeyMsg } from '@flyingrobots/bijou-tui';
import type { FileSystemPort, DirectoryAction } from '../../ports/file-system.js';
import { DIRECTORY_ACTION_OPEN, DIRECTORY_ACTION_REFRESH, FileEntryKinds } from '../../ports/file-system.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { createNotificationTickCmd, pushErrorToast } from '../../ui/feedback.js';
import { clampIndex } from './viewport.js';
import { withFocusPane } from './focus.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { ViewModes } from './view-mode.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes } from './msg.js';
import type { WorkspaceMsg } from './msg.js';
import { type Cmd } from '@flyingrobots/bijou-tui';
import type { ProductionTextSession } from './production-text-session.js';
import { createWorkspaceTextOpenCmd, defaultWorkspaceTextAperture } from './workspace-text-commands.js';
import { pendingWorkspaceTextOpen } from './workspace-text-authority.js';
import {
  isWorkspaceBackKey,
  isWorkspaceDownKey,
  isWorkspaceOpenKey,
  isWorkspaceRefreshKey,
  isWorkspaceUpKey,
} from './workspace-key.js';

export const FILE_TREE_META_MIN = 0;

interface UpdateTreeFromKeyDeps {
  readonly fileSystem: FileSystemPort;
  readonly editorFile: EditorFilePort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly graftSession: GraftSessionPort;
  readonly productionTextSession: ProductionTextSession;
}

export function updateTreeFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  nowMs: () => number,
  deps: UpdateTreeFromKeyDeps,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const navigation = updateTreeNavigationFromKey(msg, model);
  if (navigation != null) {
    return [navigation, []];
  }

  if (isWorkspaceRefreshKey(msg)) {
    return changeDirectory(model, model.cwd, DIRECTORY_ACTION_REFRESH, nowMs, deps.fileSystem);
  }
  if (isWorkspaceBackKey(msg)) {
    return openParentDirectory(model, nowMs, deps.fileSystem);
  }
  return isWorkspaceOpenKey(msg)
    ? openSelectedTreeEntry(model, nowMs, deps)
    : [model, []];
}

function updateTreeNavigationFromKey(msg: KeyMsg, model: WorkspaceModel): WorkspaceModel | undefined {
  if (isWorkspaceDownKey(msg)) {
    return {
      ...model,
      selectedIndex: clampIndex(model.selectedIndex + 1, model.entries.length),
    };
  }
  if (isWorkspaceUpKey(msg)) {
    return {
      ...model,
      selectedIndex: clampIndex(model.selectedIndex - 1, model.entries.length),
    };
  }
  return undefined;
}

function openParentDirectory(
  model: WorkspaceModel,
  nowMs: () => number,
  fileSystem: FileSystemPort,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const parent = fileSystem.dirname(model.cwd);
  return parent === model.cwd
    ? [model, []]
    : changeDirectory(model, parent, DIRECTORY_ACTION_OPEN, nowMs, fileSystem);
}

function openSelectedTreeEntry(
  model: WorkspaceModel,
  nowMs: () => number,
  deps: UpdateTreeFromKeyDeps,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const entry = model.entries[model.selectedIndex];
  if (entry == null) {
    return [model, []];
  }
  if (entry.kind === FileEntryKinds.Directory || entry.kind === FileEntryKinds.Parent) {
    return changeDirectory(model, entry.path, DIRECTORY_ACTION_OPEN, nowMs, deps.fileSystem);
  }
  return openEditorEntry(model, entry.path, nowMs, deps);
}

function openEditorEntry(
  model: WorkspaceModel,
  path: string,
  nowMs: () => number,
  deps: UpdateTreeFromKeyDeps,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const requestId = model.textRequestId + 1;
  const atMs = nowMs();
  return [withFocusPane({
    ...model,
    textRequestId: requestId,
    textAuthority: pendingWorkspaceTextOpen(model.textRuntimeProfile, path, requestId, atMs),
    editor: undefined,
    viewMode: ViewModes.Source,
    graftInfo: undefined,
    graftLoading: false,
    graftSelectedIndex: 0,
  }, FocusPanes.Editor), [
    createWorkspaceTextOpenCmd({
      requestId,
      filePath: path,
      editorFile: deps.editorFile,
      productionTextSession: deps.productionTextSession,
      atMs,
      aperture: defaultWorkspaceTextAperture(),
    }),
  ]];
}

function openDirectory(
  model: WorkspaceModel,
  cwd: string,
  fileSystem: FileSystemPort,
): WorkspaceModel {
  return {
    ...model,
    cwd,
    entries: fileSystem.loadEntries(cwd),
    selectedIndex: 0,
  };
}

function changeDirectory(
  model: WorkspaceModel,
  cwd: string,
  action: DirectoryAction,
  nowMs: () => number,
  fileSystem: FileSystemPort,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  try {
    return [openDirectory(model, cwd, fileSystem), []];
  } catch (cause) {
    const issue = fileSystem.describeDirectoryIssue(action, cwd, cause instanceof Error ? cause : String(cause));
    return pushErrorToast(
      model,
      issue.title,
      issue.message,
      nowMs(),
      () => createNotificationTickCmd((atMs: number): WorkspaceMsg => ({
        type: WorkspaceMessageTypes.NotificationTick,
        atMs,
      })),
    );
  }
}

export function settingsRows(model: WorkspaceModel) {
  return [
    FILE_TREE_META_MIN,
    model.entries.length,
    isWorkspaceMarkdownFile(model.cwd),
  ];
}
