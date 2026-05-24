import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY, JEDIT_THEME_TOGGLE_KEY } from '../keybindings.js';
import { nextJeditTheme } from '../../ui/jedit-themes.js';
import { toggleMarkdownPreview } from './editor-session.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';

export function updateThemeKey(msg: KeyMsg, model: WorkspaceModel): [WorkspaceModel, []] | undefined {
  if (!msg.ctrl || msg.alt || msg.key !== JEDIT_THEME_TOGGLE_KEY) {
    return undefined;
  }
  return [{ ...model, jeditTheme: nextJeditTheme(model.jeditTheme) }, []];
}

export function updateMarkdownPreviewKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
) {
  return msg.key === JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY
    ? toggleMarkdownPreview(model, context.deps.sourceHighlighter)
    : undefined;
}
