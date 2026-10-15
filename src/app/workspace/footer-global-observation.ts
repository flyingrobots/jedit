import type { WorkspaceModel } from './model.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import { WorkspaceBufferIntentDurabilityKinds } from './workspace-buffer-durability.js';

/** Count known buffers, replacing a cached active projection with its live state. */
export function footerGlobalObservation(model: WorkspaceModel) {
  const records = Object.values(model.buffers ?? {});
  const active = model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened ? model.textAuthority : undefined;
  const activeId = model.activeBufferId ?? active?.bufferId;
  const other = records.filter((record) => record.bufferId !== activeId && record.pathBinding !== model.editor?.path);
  const editors = other.map((record) => record.editorProjection);
  if (model.editor != null) editors.push(model.editor);
  const intents = other.map((record) => record.textAuthority.durability.intent);
  if (active != null) intents.push(active.durability.intent);
  const modified = editors.filter((editor) => editor.dirty).length;
  const pending = intents.filter((intent) => intent.kind === WorkspaceBufferIntentDurabilityKinds.Pending).length;
  const bufferCount = Math.max(records.length, editors.length);
  const modifiedText = model.i18n.t('footer.status.modified_count', { count: modified });
  const pendingText = pending > 0 ? model.i18n.t('footer.status.pending_count', { count: pending }) : '';
  return {
    workspace: model.workspaceRoot,
    globalSummary: [model.i18n.t('footer.status.buffer_count', { count: bufferCount }), modifiedText, pendingText].filter(Boolean).join(' · '),
    globalCompact: [modifiedText, pendingText].filter(Boolean).join(' · '),
  };
}
