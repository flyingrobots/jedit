import type { Surface } from '@flyingrobots/bijou';
import {
  renderInlineCompletionPopup,
  resolveInlineCompletionPopupGeometry,
} from '../../ui/inline-completion-popup.js';
import {
  workspaceCommandLineCompletionItems,
} from './command-completion.js';
import {
  workspaceCommandLineCompletionPreview,
} from './command-completion-preview.js';
import type { WorkspaceModel } from './model.js';
import {
  FOOTER_ROWS,
  MIN_COLUMNS,
  MIN_ROWS,
} from './viewport.js';
import { workspaceHasOpenFile } from './workspace-model-query.js';

const COMMAND_COMPLETION_POPUP_MAX_WIDTH = 64;
const COMMAND_COMPLETION_POPUP_EDGE_INSET = 1;
const COMMAND_COMPLETION_POPUP_MAX_HEIGHT = 8;
const COMMAND_COMPLETION_CURSOR_PREFIX_WIDTH = 1;
const COMMAND_COMPLETION_DEFAULT_ANCHOR_INDEX = 0;
const COMMAND_COMPLETION_COMMAND_LINE_ROWS = 1;

export function paintWorkspaceCommandCompletionOverlay(
  screen: Surface,
  model: WorkspaceModel,
): void {
  if (!shouldRenderCommandLineCompletionPopup(model)) {
    return;
  }

  const popup = commandLineCompletionPopupContext(model);
  if (popup == null) {
    return;
  }

  const geometry = resolveInlineCompletionPopupGeometry({
    items: popup.items,
    width: popup.width,
    maxHeight: COMMAND_COMPLETION_POPUP_MAX_HEIGHT,
    preview: popup.preview,
    anchor: popup.anchor,
  });
  screen.blit(
    renderInlineCompletionPopup({
      items: popup.items,
      selectedIndex: model.commandLine.selectedCompletionIndex,
      theme: model.jeditTheme,
      width: popup.width,
      maxHeight: COMMAND_COMPLETION_POPUP_MAX_HEIGHT,
      preview: popup.preview,
      anchor: popup.anchor,
    }),
    geometry.x,
    geometry.y,
  );
}

function commandLineCompletionPopupContext(model: WorkspaceModel) {
  const items = workspaceCommandLineCompletionItems({
    commandLine: model.commandLine,
    entries: model.entries,
    i18n: model.i18n,
    hasOpenFile: workspaceHasOpenFile(model),
  });
  if (items.length === 0) {
    return undefined;
  }

  return {
    items,
    preview: workspaceCommandLineCompletionPreview({
      commandLine: model.commandLine,
      entries: model.entries,
      hasOpenFile: workspaceHasOpenFile(model),
      filePreview: model.commandLineFilePreview,
    }),
    width: commandCompletionPopupWidth(model.columns),
    anchor: commandLineCompletionPopupAnchor(model),
  };
}

function commandLineCompletionPopupAnchor(model: WorkspaceModel) {
  return {
    x: commandLineCompletionAnchorIndex(model) +
      COMMAND_COMPLETION_CURSOR_PREFIX_WIDTH,
    y: model.rows - FOOTER_ROWS,
    screenWidth: model.columns,
    screenHeight: model.rows - FOOTER_ROWS + COMMAND_COMPLETION_COMMAND_LINE_ROWS,
  };
}

function commandLineCompletionAnchorIndex(model: WorkspaceModel): number {
  return (
    model.commandLine.anchorCursorIndex ?? COMMAND_COMPLETION_DEFAULT_ANCHOR_INDEX
  );
}

function shouldRenderCommandLineCompletionPopup(model: WorkspaceModel): boolean {
  return (
    model.commandLine.active &&
    model.footerVisible &&
    model.columns >= MIN_COLUMNS &&
    model.rows >= MIN_ROWS
  );
}

function commandCompletionPopupWidth(columns: number): number {
  return Math.max(
    1,
    Math.min(
      COMMAND_COMPLETION_POPUP_MAX_WIDTH,
      columns - (COMMAND_COMPLETION_POPUP_EDGE_INSET * 2),
    ),
  );
}
