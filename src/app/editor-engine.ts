import type { KeyMsg } from '@flyingrobots/bijou-tui';
import {
  EditorState,
} from '../domain/editor-state.js';

interface Viewport {
  readonly width: number;
  readonly height: number;
}

type EditorCommand = (editor: EditorState, viewport: Viewport) => EditorState;

const INSERT_MODE_COMMANDS: Record<string, EditorCommand> = {
  escape: (e) => e.with({ mode: 'normal' }),
  left: (e) => e.applyMotion({ type: 'char', direction: 'left' }),
  right: (e) => e.applyMotion({ type: 'char', direction: 'right' }),
  up: (e) => e.applyMotion({ type: 'char', direction: 'up' }),
  down: (e) => e.applyMotion({ type: 'char', direction: 'down' }),
  home: (e) => e.applyMotion({ type: 'line', target: 'start' }),
  end: (e) => e.applyMotion({ type: 'line', target: 'end' }),
  pageup: (e, v) => e.applyMotion({ type: 'char', direction: 'up', delta: v.height }),
  pagedown: (e, v) => e.applyMotion({ type: 'char', direction: 'down', delta: v.height }),
  backspace: (e) => e.applyMutation({ type: 'backspace' }),
  delete: (e) => e.applyMutation({ type: 'delete', target: 'char' }),
  enter: (e) => e.applyMutation({ type: 'newline' }),
};

export function updateInsertMode(
  editor: EditorState,
  msg: KeyMsg,
  viewportWidth: number,
  viewportHeight: number,
  allowTabIndent: boolean,
): EditorState {
  if (editor.readOnly) return editor;
  const viewport = { width: Math.max(1, viewportWidth), height: Math.max(1, viewportHeight) };

  const cmd = INSERT_MODE_COMMANDS[msg.key];
  if (cmd != null) {
    return cmd(editor, viewport).ensureVisible(viewport.width, viewport.height);
  }

  if (allowTabIndent && msg.key === 'tab') {
    return editor.applyMutation({ type: 'insert', text: '  ' }).ensureVisible(viewport.width, viewport.height);
  }

  const inserted = keyToText(msg);
  if (inserted != null) {
    return editor.applyMutation({ type: 'insert', text: inserted }).ensureVisible(viewport.width, viewport.height);
  }

  return editor.ensureVisible(viewport.width, viewport.height);
}

const NORMAL_MODE_MOTIONS: Record<string, EditorCommand> = {
  h: (e) => e.applyMotion({ type: 'char', direction: 'left' }),
  l: (e) => e.applyMotion({ type: 'char', direction: 'right' }),
  j: (e) => e.applyMotion({ type: 'char', direction: 'down' }),
  k: (e) => e.applyMotion({ type: 'char', direction: 'up' }),
  left: (e) => e.applyMotion({ type: 'char', direction: 'left' }),
  right: (e) => e.applyMotion({ type: 'char', direction: 'right' }),
  down: (e) => e.applyMotion({ type: 'char', direction: 'down' }),
  up: (e) => e.applyMotion({ type: 'char', direction: 'up' }),
  home: (e) => e.applyMotion({ type: 'line', target: 'start' }),
  end: (e) => e.applyMotion({ type: 'line', target: 'end' }),
  pageup: (e, v) => e.applyMotion({ type: 'char', direction: 'up', delta: v.height }),
  pagedown: (e, v) => e.applyMotion({ type: 'char', direction: 'down', delta: v.height }),
  '0': (e) => e.applyMotion({ type: 'line', target: 'start' }),
  '$': (e) => e.applyMotion({ type: 'line', target: 'end' }),
  '^': (e) => e.applyMotion({ type: 'line', target: 'first-non-whitespace' }),
  w: (e) => e.applyMotion({ type: 'word', target: 'start' }),
  b: (e) => e.applyMotion({ type: 'word', target: 'prev-start' }),
  e: (e) => e.applyMotion({ type: 'word', target: 'end' }),
};

const NORMAL_MODE_ACTIONS: Record<string, EditorCommand> = {
  i: (e) => e.with({ mode: 'insert' }),
  a: (e) => e.applyMotion({ type: 'char', direction: 'right' }).with({ mode: 'insert' }),
  A: (e) => e.applyMotion({ type: 'line', target: 'end' }).with({ mode: 'insert' }),
  I: (e) => e.applyMotion({ type: 'line', target: 'first-non-whitespace' }).with({ mode: 'insert' }),
  o: (e) => e.applyMutation({ type: 'newline' }).with({ mode: 'insert' }),
  u: (e) => e.undo(),
  x: (e) => e.applyMutation({ type: 'delete', target: 'char' }),
  p: (e) => e.applyMutation({ type: 'paste', placement: 'after' }),
  P: (e) => e.applyMutation({ type: 'paste', placement: 'before' }),
};

export function updateNormalMode(
  editor: EditorState,
  msg: KeyMsg,
  viewportWidth: number,
  viewportHeight: number,
): EditorState {
  const viewport = { width: Math.max(1, viewportWidth), height: Math.max(1, viewportHeight) };

  if (msg.key === 'escape') {
    return editor.with({ pendingNormal: undefined }).ensureVisible(viewport.width, viewport.height);
  }

  if (editor.pendingNormal != null) {
    return handlePendingNormal(editor, msg, viewport);
  }

  if (msg.ctrl && !msg.alt && !msg.shift && msg.key === 'r') {
    return editor.redo().ensureVisible(viewport.width, viewport.height);
  }

  if (!msg.ctrl && !msg.alt) {
     const key = msg.shift ? msg.key.toUpperCase() : msg.key;
     const cmd = NORMAL_MODE_ACTIONS[key] || NORMAL_MODE_MOTIONS[key];
     if (cmd != null) {
       return cmd(editor, viewport).ensureVisible(viewport.width, viewport.height);
     }
     
     if (['d', 'c', 'y', 'g'].includes(msg.key)) {
       return editor.with({ pendingNormal: msg.key as any }).ensureVisible(viewport.width, viewport.height);
     }
  }

  return editor.ensureVisible(viewport.width, viewport.height);
}

function handlePendingNormal(editor: EditorState, msg: KeyMsg, viewport: Viewport): EditorState {
  const cleared = editor.with({ pendingNormal: undefined });
  
  if (editor.pendingNormal === 'g') {
    if (msg.key === 'g') return cleared.applyMotion({ type: 'document', target: 'top' }).ensureVisible(viewport.width, viewport.height);
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  const opMap: Record<string, 'change' | 'delete' | 'yank'> = {
    c: 'change',
    d: 'delete',
    y: 'yank',
  };

  const op = opMap[editor.pendingNormal ?? ''];
  if (op != null) {
    const next = applyPendingOperator(cleared, op, msg);
    if (next != null) return next.ensureVisible(viewport.width, viewport.height);
  }
  
  return updateNormalMode(cleared, msg, viewport.width, viewport.height);
}

function applyPendingOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  msg: KeyMsg,
): EditorState | undefined {
  if (msg.ctrl || msg.alt) return undefined;
  const key = msg.key;

  if (operator === 'delete' && key === 'd') return editor.applyMutation({ type: 'delete', target: 'line' });
  if (operator === 'change' && key === 'c') return editor.applyMutation({ type: 'delete', target: 'line' }).with({ mode: 'insert' });
  if (operator === 'yank' && key === 'y') return editor.applyMutation({ type: 'yank', target: 'line' });

  return undefined;
}

function keyToText(msg: KeyMsg): string | undefined {
  if (msg.ctrl || msg.alt) return undefined;
  if (msg.key === 'space') return ' ';
  if (msg.key.length !== 1) return undefined;
  return msg.key;
}
