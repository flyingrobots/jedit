import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { beginEditorProjectionRefresh, saveEditor } from './editor-session.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';
import { createWorkspaceTextExportCmd } from './workspace-text-commands.js';
import {
  WorkspaceTextAuthorityKinds,
  WorkspaceTextIntentStatuses,
  type WorkspaceTextAuthorityOpened,
} from './workspace-text-authority.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateSaveKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (!msg.ctrl || msg.alt || msg.key !== WorkspaceKeys.S) {
    return undefined;
  }
  return saveWorkspace(model, context);
}

export function saveWorkspace(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (model.editor == null) {
    return [model, []];
  }
  if (model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened) {
    return saveProductionText(model, context);
  }
  return saveLegacyEditor(model, context);
}

function saveLegacyEditor(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (model.editor == null) {
    return [model, []];
  }
  const editor = saveEditor(model.editor, context.deps.editorFile);
  return beginEditorProjectionRefresh({ ...model, editor }, {
    refreshGraft: shouldRefreshGraft(model, editor.path),
  }, context.deps);
}

function saveProductionText(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return [model, []];
  }
  const requestId = model.textRequestId + 1;
  const base = {
    requestId,
    filePath: model.textAuthority.filePath,
    bufferId: model.textAuthority.bufferId,
    productionTextSession: context.deps.productionTextSession,
    atMs: context.nowMs(),
  };
  return [{
    ...model,
    textRequestId: requestId,
  }, [
    createWorkspaceTextExportCmd({
      ...base,
      hostBasis: model.textAuthority.hostBasis,
      hostFingerprint: model.textAuthority.hostFingerprint,
      editorFile: context.deps.editorFile,
    }),
  ]];
}

export function hasUnresolvedProductionTextIntent(model: WorkspaceModel): boolean {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened && hasUnresolvedTextIntent(model.textAuthority);
}

function hasUnresolvedTextIntent(authority: WorkspaceTextAuthorityOpened): boolean {
  return authority.pendingIntentStatus != null &&
    authority.pendingIntentStatus !== WorkspaceTextIntentStatuses.Admitted;
}

function shouldRefreshGraft(model: WorkspaceModel, editorPath: string): boolean {
  return model.graftDrawerOpen || model.graftInfo?.path === editorPath;
}
