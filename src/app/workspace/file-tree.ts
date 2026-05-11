import { dirname } from 'node:path';
import type { KeyMsg } from '@flyingrobots/bijou-tui';
import type { FileSystemPort, DirectoryAction } from '../../ports/file-system.js';
import { DIRECTORY_ACTION_OPEN, DIRECTORY_ACTION_REFRESH } from '../../ports/file-system.js';
import { pushErrorToast } from '../../ui/feedback.js';
import { clampIndex } from './viewport.js';
import { withFocusPane } from './focus.js';
import { beginEditorProjectionRefresh, isWorkspaceMarkdownFile, loadEditor } from './editor-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { type Cmd } from '@flyingrobots/bijou-tui';

export const FILE_TREE_META_MIN = 0;

export function updateTreeFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  nowMs: () => number,
  fileSystem: FileSystemPort,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (msg.key === 'r') {
    return changeDirectory(model, model.cwd, DIRECTORY_ACTION_REFRESH, nowMs, fileSystem);
  }

  if (msg.key === 'backspace' || msg.key === 'left' || msg.key === 'h') {
    const parent = dirname(model.cwd);
    if (parent === model.cwd) {
      return [model, []];
    }

    return changeDirectory(model, parent, DIRECTORY_ACTION_OPEN, nowMs, fileSystem);
  }

  if (msg.key === 'down' || msg.key === 'j') {
    return [
      {
        ...model,
        selectedIndex: clampIndex(model.selectedIndex + 1, model.entries.length),
      },
      [],
    ];
  }

  if (msg.key === 'up' || msg.key === 'k') {
    return [
      {
        ...model,
        selectedIndex: clampIndex(model.selectedIndex - 1, model.entries.length),
      },
      [],
    ];
  }

  if (msg.key === 'enter' || msg.key === 'right' || msg.key === 'l') {
    const entry = model.entries[model.selectedIndex];
    if (entry == null) {
      return [model, []];
    }

    if (entry.kind === 'dir' || entry.kind === 'parent') {
      return changeDirectory(model, entry.path, DIRECTORY_ACTION_OPEN, nowMs, fileSystem);
    }

    const editor = loadEditor(entry.path);
    return beginEditorProjectionRefresh(withFocusPane({
      ...model,
      editor,
      viewMode: 'source',
      graftInfo: undefined,
      graftLoading: false,
      graftSelectedIndex: 0,
    }, 'editor'), model.graftDrawerOpen);
  }

  return [model, []];
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
    const command = pushErrorToast(model, issue.title, issue.message, nowMs(), (atMs) => ({
      type: 'notification-tick',
      atMs,
    }));
    return [model, command];
  }
}

export function settingsRows(model: WorkspaceModel) {
  return [
    FILE_TREE_META_MIN,
    model.entries.length,
    isWorkspaceMarkdownFile(model.cwd),
  ];
}
