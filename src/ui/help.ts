import type { Overlay } from '@flyingrobots/bijou-tui';

import { JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL, JEDIT_SETTINGS_TOGGLE_LABEL } from '../app/keybindings.js';
import { renderHelpOverlay } from './feedback.js';

const HELP_DIALOG_TITLE = 'jedit';
const HELP_DIALOG_HINT = 'esc or ? to close';
const HELP_DIALOG_BODY = [
  'files',
  '  tab          open file drawer',
  '  j / k        move',
  '  enter        open file or directory',
  '  backspace    go up',
  '  r            refresh drawer',
  '',
  'editor',
  '  i a A I o O  insert modes',
  '  h j k l      move',
  '  w b e        word motions',
  '  dd yy p      delete, yank, paste',
  '  u ctrl+r     undo, redo',
  '  ctrl+s       save',
  `  ${JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL}           markdown preview/source toggle`,
  '',
  'settings',
  `  ${JEDIT_SETTINGS_TOGGLE_LABEL}           open or close settings`,
  '  j / k        move',
  '  enter        change selected setting',
  '',
  'graft',
  '  ctrl+g       open graft drawer',
  '  enter        jump to symbol',
  '',
  'general',
  '  ?            helper',
  '  q            quit',
].join('\n');

export function createEditorHelpOverlay(columns: number, rows: number): Overlay {
  return renderHelpOverlay(columns, rows, HELP_DIALOG_TITLE, HELP_DIALOG_BODY, HELP_DIALOG_HINT);
}
