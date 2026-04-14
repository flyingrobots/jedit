import { createSurface, stringToSurface, type Surface, type TokenValue } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import { basename } from 'node:path';

import type { FileEntry } from '../adapters/filesystem.js';

type DrawerKind = 'files' | 'graft';
type ViewMode = 'source' | 'preview';
type EditorMode = 'normal' | 'insert';
type PendingNormal = 'c' | 'd' | 'g' | 'y';

export interface WorkspaceTitleState {
  readonly cwd: string;
  readonly editorPath?: string;
  readonly editorDirty: boolean;
  readonly selectedEntry?: FileEntry;
}

export interface WorkspaceFooterState {
  readonly drawerOpen: boolean;
  readonly drawerKind: DrawerKind;
  readonly viewMode: ViewMode;
  readonly markdownPreviewActive: boolean;
  readonly editorMode?: EditorMode;
  readonly pendingNormal?: PendingNormal;
}

export function activeWorkspaceTitle(state: WorkspaceTitleState): string {
  if (state.editorPath != null) {
    const mark = state.editorDirty ? ' *' : '';
    return `${basename(state.editorPath)}${mark}`;
  }

  if (state.selectedEntry?.kind === 'file') {
    return state.selectedEntry.name;
  }

  return displayName(state.cwd);
}

export function centerLine(text: string, width: number): string {
  const clipped = clipToWidth(text, width);
  const visible = [...clipped].length;
  if (visible >= width) {
    return clipped;
  }

  const left = Math.floor((width - visible) / 2);
  const right = width - visible - left;
  return `${' '.repeat(left)}${clipped}${' '.repeat(right)}`;
}

export function renderWorkspaceFooter(state: WorkspaceFooterState, width: number, background: TokenValue): Surface {
  const surface = createSurface(width, 1);
  fillSurface(surface, background);

  const content = stringToSurface(fitLine(footerLine(state), width), width, 1);
  applyBackground(content, background);
  surface.blit(content, 0, 0);
  return surface;
}

function footerLine(state: WorkspaceFooterState): string {
  const segments = [
    `mode ${interactionModeLabel(state)}`,
    `chord ${chordLabel(state)}`,
    primaryFooterHint(state),
    secondaryFooterHint(state),
    '? footer',
  ];

  return segments.filter((segment) => segment.length > 0).join(' · ');
}

function interactionModeLabel(state: WorkspaceFooterState): string {
  if (state.drawerOpen) {
    return state.drawerKind;
  }

  if (state.viewMode === 'preview' && state.markdownPreviewActive) {
    return 'preview';
  }

  if (state.editorMode != null) {
    return state.editorMode;
  }

  return 'browse';
}

function chordLabel(state: WorkspaceFooterState): string {
  if (state.drawerOpen) {
    return state.drawerKind === 'files' ? 'tab' : 'ctrl+g';
  }

  if (state.editorMode == null || state.viewMode === 'preview') {
    return 'none';
  }

  if (state.editorMode === 'insert') {
    return 'literal';
  }

  return state.pendingNormal ?? 'none';
}

function primaryFooterHint(state: WorkspaceFooterState): string {
  if (state.drawerOpen) {
    return state.drawerKind === 'files' ? 'tab close' : 'ctrl+g close';
  }

  return 'tab files';
}

function secondaryFooterHint(state: WorkspaceFooterState): string {
  if (state.drawerOpen) {
    return state.drawerKind === 'files' ? 'ctrl+g graft' : 'tab files';
  }

  if (state.editorMode === 'insert' && state.viewMode === 'source') {
    return 'esc normal';
  }

  if (state.markdownPreviewActive) {
    return 'f2 source/preview';
  }

  return 'ctrl+g graft';
}

function displayName(path: string): string {
  const name = basename(path);
  return name.length > 0 ? name : path;
}

function fillSurface(surface: Surface, token: TokenValue) {
  surface.fill({
    char: ' ',
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyBackground(surface: Surface, token: TokenValue) {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        char: cell.char.length > 0 ? cell.char : ' ',
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
}

function fitLine(text: string, width: number): string {
  const clipped = clipToWidth(text, width);
  const visible = [...clipped].length;
  if (visible >= width) {
    return clipped;
  }

  return clipped.padEnd(width, ' ');
}
