import { createSurface, stringToSurface, type Surface, type TokenValue } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import { basename } from 'node:path';

import type { FileEntry } from '../adapters/filesystem.js';
import type { DrawerKind } from './drawer-layout.js';
import type { FocusPane } from './panel-focus.js';

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
  readonly focusPane: FocusPane;
  readonly fileDrawerOpen: boolean;
  readonly graftDrawerOpen: boolean;
  readonly viewMode: ViewMode;
  readonly markdownPreviewActive: boolean;
  readonly editorMode?: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly cwd: string;
  readonly selectedEntry?: FileEntry;
  readonly editorPath?: string;
  readonly graftPath?: string;
  readonly graftSelection?: {
    readonly kind: string;
    readonly name: string;
    readonly startLine: number;
  };
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
  const surface = createSurface(width, 2);
  fillSurface(surface, background);

  const [primary, secondary] = workspaceFooterLines(state);
  const primarySurface = stringToSurface(fitLine(primary, width), width, 1);
  const secondarySurface = stringToSurface(fitLine(secondary, width), width, 1);
  applyBackground(primarySurface, background);
  applyBackground(secondarySurface, background);
  surface.blit(primarySurface, 0, 0);
  surface.blit(secondarySurface, 0, 1);
  return surface;
}

export function workspaceFooterLine(state: WorkspaceFooterState): string {
  return workspaceFooterLines(state)[0];
}

export function workspaceFooterLines(state: WorkspaceFooterState): readonly [string, string] {
  const mode = interactionModeLabel(state).toUpperCase();
  const detail = footerDetail(state);
  return [
    detail.length > 0 ? `${mode} ${detail}` : mode,
    footerContextLine(state),
  ];
}

function interactionModeLabel(state: WorkspaceFooterState): string {
  if (state.focusPane === 'files' && state.fileDrawerOpen) {
    return 'files';
  }

  if (state.focusPane === 'graft' && state.graftDrawerOpen) {
    return 'graft';
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
  if (state.focusPane === 'files' && state.fileDrawerOpen) {
    return drawerFooterDetail('files');
  }

  if (state.focusPane === 'graft' && state.graftDrawerOpen) {
    return drawerFooterDetail('graft');
  }

  if (state.viewMode === 'preview' && state.markdownPreviewActive) {
    return '[j/k scroll · f2 source · tab focus · ctrl+b files · ctrl+g graft]';
  }

  if (state.editorMode === 'insert') {
    return '[text input · esc normal · ctrl+s save · tab focus]';
  }

  if (state.editorMode === 'normal') {
    return normalFooterDetail(state);
  }

  return '[tab focus · ctrl+b files · ctrl+g graft]';
}

function drawerFooterDetail(kind: DrawerKind): string {
  if (kind === 'files') {
    return '[j/k move · enter open · backspace up · ctrl+b close · tab focus]';
  }

  return '[j/k move · enter jump · r refresh · ctrl+g close · tab focus]';
}

function normalFooterDetail(state: WorkspaceFooterState): string {
  const pending = state.pendingNormal;
  if (pending != null) {
    return pendingNormalFooterDetail(pending);
  }

  const previewHint = state.markdownPreviewActive ? 'f2 preview' : 'ctrl+s save';
  return `[i insert · o open line · ${previewHint} · tab focus]`;
}

function pendingNormalFooterDetail(pending: PendingNormal): string {
  if (pending === 'c') {
    return 'c [cc line · cw word · ce word-end · c0 start · c$ end · tab focus]';
  }

  if (pending === 'd') {
    return 'd [dd line · dw word · de word-end · d0 start · d$ end · tab focus]';
  }

  if (pending === 'y') {
    return 'y [yy line · yw word · ye word-end · y0 start · y$ end · tab focus]';
  }

  return 'g [gg top · esc cancel · tab focus]';
}

function footerContextLine(state: WorkspaceFooterState): string {
  if (state.focusPane === 'files' && state.fileDrawerOpen) {
    return state.selectedEntry?.path ?? state.cwd;
  }

  if (state.focusPane === 'graft' && state.graftDrawerOpen) {
    if (state.graftSelection != null && state.graftPath != null) {
      return `${state.graftPath}:${state.graftSelection.startLine} ${state.graftSelection.kind} ${state.graftSelection.name}`;
    }

    if (state.graftPath != null) {
      return state.graftPath;
    }

    return 'open a file to inspect it';
  }

  if (state.editorPath != null) {
    return state.editorPath;
  }

  return state.cwd;
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
