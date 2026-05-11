import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import { basename } from 'node:path';

import type { FileEntry } from '../ports/file-system.js';
import {
  JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL,
  JEDIT_SCENE_PICKER_TOGGLE_LABEL,
  JEDIT_SETTINGS_TOGGLE_LABEL,
  JEDIT_THEME_TOGGLE_LABEL,
} from '../app/keybindings.js';
import type { I18nPort } from '../ports/i18n.js';
import type { JeditStyleToken } from './jedit-theme.js';
import type { DrawerKind } from './drawer-layout.js';
import { hasFocusablePeers, type FocusPane } from './panel-focus.js';

type ViewMode = 'source' | 'preview';
type EditorMode = 'normal' | 'insert';
type PendingNormal = 'c' | 'd' | 'g' | 'y';

const THEME_HINT = `${JEDIT_THEME_TOGGLE_LABEL} theme`;
const SCENE_PICKER_HINT = `${JEDIT_SCENE_PICKER_TOGGLE_LABEL} scenes`;

export interface WorkspaceTitleState {
  readonly cwd: string;
  readonly editorPath?: string;
  readonly editorDirty: boolean;
  readonly selectedEntry?: FileEntry;
}

export interface WorkspaceFooterState {
  readonly i18n: I18nPort;
  readonly focusPane: FocusPane;
  readonly fileDrawerOpen: boolean;
  readonly graftDrawerOpen: boolean;
  readonly viewMode: ViewMode;
  readonly markdownPreviewActive: boolean;
  readonly settingsOpen: boolean;
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

export function renderWorkspaceFooter(state: WorkspaceFooterState, width: number, background: JeditStyleToken): Surface {
  const surface = createSurface(width, 2);
  fillSurface(surface, background);

  const [primary, secondary] = workspaceFooterLines(state);
  const primarySurface = stringToSurface(fitLine(primary, width), width, 1);
  const secondarySurface = stringToSurface(fitLine(secondary, width), width, 1);
  applyBackground(primarySurface, background);
  applyBackground(secondarySurface, background);

  // Logical positioning for RTL/LTR
  const isRtl = state.i18n.direction === 'rtl';
  surface.blit(primarySurface, isRtl ? width - primarySurface.width : 0, 0);
  surface.blit(secondarySurface, isRtl ? width - secondarySurface.width : 0, 1);
  return surface;
}

export function workspaceFooterLine(state: WorkspaceFooterState): string {
  return workspaceFooterLines(state)[0];
}

export function workspaceFooterLines(state: WorkspaceFooterState): readonly [string, string] {
  const modeKey = interactionModeKey(state);
  const modeLabel = state.i18n.t(`footer.mode.${modeKey}`).toUpperCase();
  const detail = footerDetail(state);
  
  const primary = detail.length > 0 ? `${modeLabel} ${detail}` : modeLabel;
  const secondary = footerContextLine(state);

  return [primary, secondary];
}

function interactionModeKey(state: WorkspaceFooterState): string {
  if (state.settingsOpen) {
    return 'settings';
  }

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
  const t = (key: string) => state.i18n.t(`footer.hints.${key}`);

  if (state.settingsOpen) {
    return footerHints([t('j_k_move'), t('enter_change'), `${JEDIT_SETTINGS_TOGGLE_LABEL} close`, 'esc close']);
  }

  if (state.focusPane === 'files' && state.fileDrawerOpen) {
    return drawerFooterDetail(state, 'files');
  }

  if (state.focusPane === 'graft' && state.graftDrawerOpen) {
    return drawerFooterDetail(state, 'graft');
  }

  if (state.viewMode === 'preview' && state.markdownPreviewActive) {
    return footerHints([t('j_k_scroll'), `${JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL} source`, THEME_HINT, focusHint(state), 'ctrl+b files', 'ctrl+g graft']);
  }

  if (state.editorMode === 'insert') {
    return footerHints([t('text_input'), t('esc_normal'), t('ctrl_s_save'), THEME_HINT, insertTabHint(state)]);
  }

  if (state.editorMode === 'normal') {
    return normalFooterDetail(state);
  }

  return footerHints([SCENE_PICKER_HINT, focusHint(state), THEME_HINT, 'ctrl+b files', 'ctrl+g graft']);
}

function drawerFooterDetail(state: WorkspaceFooterState, kind: DrawerKind): string {
  const t = (key: string) => state.i18n.t(`footer.hints.${key}`);

  if (kind === 'files') {
    return footerHints([t('j_k_move'), 'enter open', 'backspace up', 'ctrl+b close', THEME_HINT, focusHint(state)]);
  }

  return footerHints([t('j_k_move'), 'enter jump', 'r refresh', 'ctrl+g close', THEME_HINT, focusHint(state)]);
}

function normalFooterDetail(state: WorkspaceFooterState): string {
  const pending = state.pendingNormal;
  if (pending != null) {
    return pendingNormalFooterDetail(pending);
  }

  const previewHint = state.markdownPreviewActive ? `${JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL} preview` : 'ctrl+s save';
  return footerHints(['i insert', 'o open line', previewHint, THEME_HINT, focusHint(state)]);
}

function pendingNormalFooterDetail(pending: PendingNormal): string {
  if (pending === 'c') {
    return chordFooterHints('c', ['cc line', 'cw word', 'ce word-end', 'c0 start', 'c$ end']);
  }

  if (pending === 'd') {
    return chordFooterHints('d', ['dd line', 'dw word', 'de word-end', 'd0 start', 'd$ end']);
  }

  if (pending === 'y') {
    return chordFooterHints('y', ['yy line', 'yw word', 'ye word-end', 'y0 start', 'y$ end']);
  }

  return chordFooterHints('g', ['gg top', 'esc cancel']);
}

function footerContextLine(state: WorkspaceFooterState): string {
  if (state.settingsOpen) {
    return 'settings';
  }

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

function fillSurface(surface: Surface, token: JeditStyleToken) {
  surface.fill({
    char: ' ',
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyBackground(surface: Surface, token: JeditStyleToken) {
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

function footerHasFocusablePeers(state: WorkspaceFooterState): boolean {
  return hasFocusablePeers({
    fileDrawerOpen: state.fileDrawerOpen,
    graftDrawerOpen: state.graftDrawerOpen,
    hasEditor: state.editorPath != null,
    focusPane: state.focusPane,
  });
}

function focusHint(state: WorkspaceFooterState): string | undefined {
  return footerHasFocusablePeers(state) ? 'tab focus' : undefined;
}

function insertTabHint(state: WorkspaceFooterState): string {
  return footerHasFocusablePeers(state) ? 'tab focus' : 'tab indent';
}

function footerHints(parts: ReadonlyArray<string | undefined>): string {
  const filtered = parts.filter((part): part is string => part != null && part.trim().length > 0);
  return `[${filtered.join(' · ')}]`;
}

function chordFooterHints(chord: string, suggestions: readonly string[]): string {
  return `${chord} [${suggestions.join(' · ')}]`;
}
