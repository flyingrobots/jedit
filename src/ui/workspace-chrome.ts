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

  const content = stringToSurface(fitLine(workspaceFooterLine(state), width), width, 1);
  applyBackground(content, background);
  surface.blit(content, 0, 0);
  return surface;
}

export function workspaceFooterLine(state: WorkspaceFooterState): string {
  const mode = interactionModeLabel(state).toUpperCase();
  const detail = footerDetail(state);
  return detail.length > 0 ? `${mode} ${detail}` : mode;
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

function footerDetail(state: WorkspaceFooterState): string {
  if (state.drawerOpen) {
    return drawerFooterDetail(state.drawerKind);
  }

  if (state.viewMode === 'preview' && state.markdownPreviewActive) {
    return '[j/k scroll · f2 source · ? hide]';
  }

  if (state.editorMode === 'insert') {
    return '[text input · esc normal · ctrl+s save · ? hide]';
  }

  if (state.editorMode === 'normal') {
    return normalFooterDetail(state);
  }

  return '[tab files · ctrl+g graft · ? hide]';
}

function drawerFooterDetail(kind: DrawerKind): string {
  if (kind === 'files') {
    return '[j/k move · enter open · backspace up · tab close · ? hide]';
  }

  return '[j/k move · enter jump · r refresh · ctrl+g close · ? hide]';
}

function normalFooterDetail(state: WorkspaceFooterState): string {
  const pending = state.pendingNormal;
  if (pending != null) {
    return pendingNormalFooterDetail(pending);
  }

  const previewHint = state.markdownPreviewActive ? 'f2 preview' : 'ctrl+s save';
  return `[i insert · o open line · ${previewHint} · tab files · ? hide]`;
}

function pendingNormalFooterDetail(pending: PendingNormal): string {
  if (pending === 'c') {
    return 'c [cc line · cw word · ce word-end · c0 start · c$ end]';
  }

  if (pending === 'd') {
    return 'd [dd line · dw word · de word-end · d0 start · d$ end]';
  }

  if (pending === 'y') {
    return 'y [yy line · yw word · ye word-end · y0 start · y$ end]';
  }

  return 'g [gg top · esc cancel]';
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
