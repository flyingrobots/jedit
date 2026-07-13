import { jeditCommandEventFromEditor } from './command-provenance.js';
import type { EditorState } from './editor/model.js';
import type { WorkspaceTextAuthority } from './workspace-text-authority.js';

export function jeditCommandFooterSummary(
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): string | undefined {
  const event = jeditCommandEventFromEditor(editor, textAuthority);
  return event == null ? undefined : `last: ${event.summary}`;
}

export function jeditCommandHistorySummary(
  filePath: string,
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): string {
  const event = jeditCommandEventFromEditor(editor, textAuthority);
  return event == null ? filePath : `${filePath} ${event.summary}`;
}

