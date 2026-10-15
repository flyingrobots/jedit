import type { Cmd, MouseMsg } from '@flyingrobots/bijou-tui';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { updateDojoFeedMouse } from './dojo-feed.js';
import { updateFromMouse } from './mouse.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

export function updateWorkspacePointerInput(
  msg: MouseMsg,
  model: WorkspaceModel,
  highlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  return updateDojoFeedMouse(msg, model) ?? updateFromMouse(msg, model, highlighter);
}
