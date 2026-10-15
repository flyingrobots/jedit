import type { Cmd } from '@flyingrobots/bijou-tui';
import type { DirectoryAction, FileSystemPort } from '../../ports/file-system.js';
import { createNotificationTickCmd, pushErrorToast } from '../../ui/feedback.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';

export interface DirectoryExpansionContext {
  readonly fileSystem: FileSystemPort;
  readonly nowMs: () => number;
}

export function directoryChangeFailure(
  model: WorkspaceModel,
  path: string,
  action: DirectoryAction,
  cause: Error | string,
  context: DirectoryExpansionContext,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const issue = context.fileSystem.describeDirectoryIssue(action, path, cause);
  return pushErrorToast(model, issue.title, issue.message, context.nowMs(),
    () => createNotificationTickCmd((atMs: number): WorkspaceMsg => ({ type: WorkspaceMessageTypes.NotificationTick, atMs })));
}
