import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import { basename } from 'node:path';
import { FileEntryKinds, type FileEntry } from '../ports/file-system.js';
import type { I18nPort } from '../ports/i18n.js';
import type { JeditStyleToken } from './jedit-theme.js';
import { DrawerKinds, type DrawerKind } from './drawer-layout.js';
import { FocusPanes, hasFocusablePeers, type FocusPane } from './panel-focus.js';
import { ViewModes, type ViewMode } from '../app/workspace/view-mode.js';
import { EditorModes, PendingNormals, type EditorMode, type PendingNormal } from '../app/workspace/editor/mode.js';
import { renderWorkspaceCommandLineFooter, workspaceCommandLineFooterHintLine as commandLineHints } from './workspace-command-line-footer.js';
import type { WorkspaceCommandLineFooterState } from './workspace-command-line-footer.js';
const FOOTER_ROWS = 2;
const FOOTER_LINE_HEIGHT = 1;
const FOOTER_PRIMARY_ROW = 0;
const FOOTER_SECONDARY_ROW = 1;
const FOOTER_ORIGIN = 0;
const MIN_FOOTER_CONTENT_WIDTH = 1;
const TEXT_DIRECTION_RTL = 'rtl';
const FOOTER_MODE_BROWSE = 'browse';
const FOOTER_MODE_INSERT = 'insert';
const FOOTER_MODE_NORMAL = 'normal';
const FOOTER_MODE_PREVIEW = 'preview';
const FOOTER_MODE_SETTINGS = 'settings';
const FOOTER_MODE_FILES = 'files';
const FOOTER_MODE_GRAFT = 'graft';
const FOOTER_MODE_HISTORY = 'history';
const FOOTER_CONTEXT_SETTINGS = 'footer.context.settings';
const FOOTER_CONTEXT_GRAFT_EMPTY = 'footer.context.graft_empty';
const FOOTER_CONTEXT_HISTORY_EMPTY = 'footer.context.history_empty';
const FOOTER_CONTEXT_HISTORY_COUNT = 'footer.context.history_count';

const DrawerModeKeys: Record<DrawerKind, string> = Object.freeze({
  [DrawerKinds.Files]: FOOTER_MODE_FILES,
  [DrawerKinds.Graft]: FOOTER_MODE_GRAFT,
  [DrawerKinds.History]: FOOTER_MODE_HISTORY,
});

const EditorModeKeys: Record<EditorMode, string> = Object.freeze({
  [EditorModes.Insert]: FOOTER_MODE_INSERT,
  [EditorModes.Normal]: FOOTER_MODE_NORMAL,
});

const FooterHintKeys = Object.freeze({
  JkMove: 'j_k_move',
  EnterChange: 'enter_change',
  F2Close: 'f2_close',
  EscClose: 'esc_close',
  JkScroll: 'j_k_scroll',
  F3Source: 'f3_source',
  F3Preview: 'f3_preview',
  TextInput: 'text_input',
  EscNormal: 'esc_normal',
  CtrlSSave: 'ctrl_s_save',
  CtrlTTheme: 'ctrl_t_theme',
  TabFocus: 'tab_focus',
  TabIndent: 'tab_indent',
  CtrlLScenePicker: 'ctrl_l_scene_picker',
  CtrlBFiles: 'ctrl_b_files',
  CtrlGGraft: 'ctrl_g_graft',
  CtrlHHistory: 'ctrl_h_history',
  EnterOpen: 'enter_open',
  BackspaceUp: 'backspace_up',
  CtrlBClose: 'ctrl_b_close',
  EnterJump: 'enter_jump',
  RRefresh: 'r_refresh',
  CtrlGClose: 'ctrl_g_close',
  CtrlHClose: 'ctrl_h_close',
  IInsert: 'i_insert',
  OOpenLine: 'o_open_line',
  CcLine: 'cc_line',
  CwWord: 'cw_word',
  CeWordEnd: 'ce_word_end',
  C0Start: 'c0_start',
  CEnd: 'c_end',
  DdLine: 'dd_line',
  DwWord: 'dw_word',
  DeWordEnd: 'de_word_end',
  D0Start: 'd0_start',
  DEnd: 'd_end',
  YyLine: 'yy_line',
  YwWord: 'yw_word',
  YeWordEnd: 'ye_word_end',
  Y0Start: 'y0_start',
  YEnd: 'y_end',
  GgTop: 'gg_top',
  EscCancel: 'esc_cancel',
});

type FooterHintTranslator = (key: string) => string;

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
  readonly historyDrawerOpen: boolean;
  readonly viewMode: ViewMode;
  readonly markdownPreviewActive: boolean;
  readonly settingsOpen: boolean;
  readonly editorMode?: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly cwd: string;
  readonly selectedEntry?: FileEntry;
  readonly editorPath?: string;
  readonly textPosture?: string;
  readonly echoHistoryCount?: number;
  readonly historyContextLine?: string;
  readonly graftPath?: string;
  readonly graftSelection?: { readonly kind: string; readonly name: string; readonly startLine: number };
  readonly commandLine?: WorkspaceCommandLineFooterState;
  readonly commandLineError?: JeditStyleToken;
}

export function activeWorkspaceTitle(state: WorkspaceTitleState): string {
  if (state.editorPath != null) {
    const mark = state.editorDirty ? ' *' : '';
    return `${basename(state.editorPath)}${mark}`;
  }

  if (state.selectedEntry?.kind === FileEntryKinds.File) {
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
  const surface = createSurface(width, FOOTER_ROWS);
  fillSurface(surface, background);
  if (width <= FOOTER_ORIGIN) {
    return surface;
  }
  if (state.commandLine?.active === true) {
    return renderWorkspaceCommandLineFooter(
      { i18n: state.i18n, commandLine: state.commandLine, contextLine: commandLineHints(state.i18n), commandLineError: state.commandLineError },
      width,
      background,
    );
  }

  const [primary, secondary] = workspaceFooterLines(state);
  const primaryLine = footerLineSurface(primary, width, background, state.i18n.direction);
  const secondaryLine = footerLineSurface(secondary, width, background, state.i18n.direction);

  surface.blit(primaryLine.surface, primaryLine.x, FOOTER_PRIMARY_ROW);
  surface.blit(secondaryLine.surface, secondaryLine.x, FOOTER_SECONDARY_ROW);
  return surface;
}

export function workspaceFooterLines(state: WorkspaceFooterState): readonly [string, string] {
  if (state.commandLine?.active === true) {
    return [`:${state.commandLine.input}`, commandLineHints(state.i18n)];
  }
  const modeKey = interactionModeKey(state);
  const modeLabel = state.i18n.t(`footer.mode.${modeKey}`).toUpperCase();
  const detail = footerDetail(state);

  const primary = detail.length > 0 ? `${modeLabel} ${detail}` : modeLabel;
  const secondary = footerContextLine(state);

  return [primary, secondary];
}

function interactionModeKey(state: WorkspaceFooterState): string {
  if (state.settingsOpen) {
    return FOOTER_MODE_SETTINGS;
  }

  const drawerMode = activeDrawerModeKey(state);
  if (drawerMode != null) {
    return drawerMode;
  }

  return previewModeActive(state)
    ? FOOTER_MODE_PREVIEW
    : editorModeKey(state);
}

function activeDrawerModeKey(state: WorkspaceFooterState): string | undefined {
  const kind = activeDrawerKind(state);
  return kind == null ? undefined : DrawerModeKeys[kind];
}

function previewModeActive(state: WorkspaceFooterState): boolean {
  return state.viewMode === ViewModes.Preview && state.markdownPreviewActive;
}

function editorModeKey(state: WorkspaceFooterState): string {
  return state.editorMode == null ? FOOTER_MODE_BROWSE : EditorModeKeys[state.editorMode];
}

function footerDetail(state: WorkspaceFooterState): string {
  const t = footerHintTranslator(state);

  if (state.settingsOpen) {
    return footerHints([t(FooterHintKeys.JkMove), t(FooterHintKeys.EnterChange), t(FooterHintKeys.F2Close), t(FooterHintKeys.EscClose)]);
  }

  return activeFooterDetail(state, t)
    ?? footerHints([
      scenePickerHint(t),
      focusHint(state, t),
      themeHint(t),
      t(FooterHintKeys.CtrlBFiles),
      t(FooterHintKeys.CtrlGGraft),
      t(FooterHintKeys.CtrlHHistory),
    ]);
}

function activeFooterDetail(state: WorkspaceFooterState, t: FooterHintTranslator): string | undefined {
  const drawerDetail = activeDrawerFooterDetail(state, t);
  if (drawerDetail != null) {
    return drawerDetail;
  }
  if (previewModeActive(state)) {
    return footerHints(previewFooterHints(state, t));
  }
  return editorFooterDetail(state, t);
}

function activeDrawerFooterDetail(state: WorkspaceFooterState, t: FooterHintTranslator): string | undefined {
  const kind = activeDrawerKind(state);
  return kind == null ? undefined : drawerFooterDetail(state, kind, t);
}

function editorFooterDetail(state: WorkspaceFooterState, t: FooterHintTranslator): string | undefined {
  if (state.editorMode === EditorModes.Insert) {
    return footerHints(insertModeFooterHints(state, t));
  }
  return state.editorMode === EditorModes.Normal ? normalFooterDetail(state, t) : undefined;
}

function footerHintTranslator(state: WorkspaceFooterState): FooterHintTranslator {
  return (key: string) => state.i18n.t(`footer.hints.${key}`);
}

function scenePickerHint(t: FooterHintTranslator): string {
  return t(FooterHintKeys.CtrlLScenePicker);
}

function themeHint(t: FooterHintTranslator): string {
  return t(FooterHintKeys.CtrlTTheme);
}

function drawerFooterDetail(state: WorkspaceFooterState, kind: DrawerKind, t: FooterHintTranslator): string {
  if (kind === DrawerKinds.Files) {
    return footerHints(fileDrawerFooterHints(state, t));
  }

  return kind === DrawerKinds.Graft
    ? footerHints(graftDrawerFooterHints(state, t))
    : footerHints(historyDrawerFooterHints(state, t));
}

function normalFooterDetail(state: WorkspaceFooterState, t: FooterHintTranslator): string {
  const pending = state.pendingNormal;
  if (pending != null) {
    return pendingNormalFooterDetail(pending, t);
  }

  const previewHint = state.markdownPreviewActive ? t(FooterHintKeys.F3Preview) : t(FooterHintKeys.CtrlSSave);
  return footerHints([t(FooterHintKeys.IInsert), t(FooterHintKeys.OOpenLine), previewHint, themeHint(t), focusHint(state, t)]);
}

function pendingNormalFooterDetail(pending: PendingNormal, t: FooterHintTranslator): string {
  if (pending === PendingNormals.Change) {
    return chordFooterHints('c', changeFooterHints(t));
  }

  if (pending === PendingNormals.Delete) {
    return chordFooterHints('d', deleteFooterHints(t));
  }

  if (pending === PendingNormals.Yank) {
    return chordFooterHints('y', yankFooterHints(t));
  }

  return chordFooterHints('g', [t(FooterHintKeys.GgTop), t(FooterHintKeys.EscCancel)]);
}

function previewFooterHints(state: WorkspaceFooterState, t: FooterHintTranslator): ReadonlyArray<string | undefined> {
  return [
    t(FooterHintKeys.JkScroll),
    t(FooterHintKeys.F3Source),
    themeHint(t),
    focusHint(state, t),
    t(FooterHintKeys.CtrlBFiles),
    t(FooterHintKeys.CtrlGGraft),
    t(FooterHintKeys.CtrlHHistory),
  ];
}

function fileDrawerFooterHints(state: WorkspaceFooterState, t: FooterHintTranslator): ReadonlyArray<string | undefined> {
  return [
    t(FooterHintKeys.JkMove),
    t(FooterHintKeys.EnterOpen),
    t(FooterHintKeys.BackspaceUp),
    t(FooterHintKeys.CtrlBClose),
    themeHint(t),
    focusHint(state, t),
  ];
}

function graftDrawerFooterHints(state: WorkspaceFooterState, t: FooterHintTranslator): ReadonlyArray<string | undefined> {
  return [
    t(FooterHintKeys.JkMove),
    t(FooterHintKeys.EnterJump),
    t(FooterHintKeys.RRefresh),
    t(FooterHintKeys.CtrlGClose),
    themeHint(t),
    focusHint(state, t),
  ];
}

function historyDrawerFooterHints(state: WorkspaceFooterState, t: FooterHintTranslator): ReadonlyArray<string | undefined> {
  return [t(FooterHintKeys.JkMove), t(FooterHintKeys.CtrlHClose), t(FooterHintKeys.EscClose), themeHint(t), focusHint(state, t)];
}

function insertModeFooterHints(state: WorkspaceFooterState, t: FooterHintTranslator): ReadonlyArray<string | undefined> {
  return [t(FooterHintKeys.TextInput), t(FooterHintKeys.EscNormal), t(FooterHintKeys.CtrlSSave), themeHint(t), insertTabHint(state, t)];
}

function changeFooterHints(t: FooterHintTranslator): readonly string[] {
  return [t(FooterHintKeys.CcLine), t(FooterHintKeys.CwWord), t(FooterHintKeys.CeWordEnd), t(FooterHintKeys.C0Start), t(FooterHintKeys.CEnd)];
}

function deleteFooterHints(t: FooterHintTranslator): readonly string[] {
  return [t(FooterHintKeys.DdLine), t(FooterHintKeys.DwWord), t(FooterHintKeys.DeWordEnd), t(FooterHintKeys.D0Start), t(FooterHintKeys.DEnd)];
}

function yankFooterHints(t: FooterHintTranslator): readonly string[] {
  return [t(FooterHintKeys.YyLine), t(FooterHintKeys.YwWord), t(FooterHintKeys.YeWordEnd), t(FooterHintKeys.Y0Start), t(FooterHintKeys.YEnd)];
}

function footerContextLine(state: WorkspaceFooterState): string {
  if (state.settingsOpen) {
    return state.i18n.t(FOOTER_CONTEXT_SETTINGS);
  }

  const drawerContext = activeDrawerContextLine(state);
  if (drawerContext != null) {
    return drawerContext;
  }

  if (state.editorPath != null) {
    return editorFooterContextLine(state.editorPath, state.textPosture);
  }

  return state.cwd;
}

function activeDrawerContextLine(state: WorkspaceFooterState): string | undefined {
  const kind = activeDrawerKind(state);
  if (kind === DrawerKinds.Files) return state.selectedEntry?.path ?? state.cwd;
  if (kind === DrawerKinds.Graft) return graftFooterContextLine(state);
  return kind === DrawerKinds.History ? historyFooterContextLine(state) : undefined;
}

function activeDrawerKind(state: WorkspaceFooterState): DrawerKind | undefined {
  if (state.focusPane === FocusPanes.Files && state.fileDrawerOpen) {
    return DrawerKinds.Files;
  }
  if (state.focusPane === FocusPanes.Graft && state.graftDrawerOpen) {
    return DrawerKinds.Graft;
  }
  return state.focusPane === FocusPanes.History && state.historyDrawerOpen ? DrawerKinds.History : undefined;
}

function editorFooterContextLine(editorPath: string, textPosture: string | undefined): string {
  return textPosture == null ? editorPath : `${editorPath} [${textPosture}]`;
}

function graftFooterContextLine(state: WorkspaceFooterState): string {
  if (state.graftSelection != null && state.graftPath != null) {
    return `${state.graftPath}:${state.graftSelection.startLine} ${state.graftSelection.kind} ${state.graftSelection.name}`;
  }
  if (state.graftPath != null) {
    return state.graftPath;
  }
  return state.i18n.t(FOOTER_CONTEXT_GRAFT_EMPTY);
}

function historyFooterContextLine(state: WorkspaceFooterState): string {
  if (state.historyContextLine != null) return state.historyContextLine;
  const count = state.echoHistoryCount ?? 0;
  return count === 0
    ? state.i18n.t(FOOTER_CONTEXT_HISTORY_EMPTY)
    : state.i18n.t(FOOTER_CONTEXT_HISTORY_COUNT, { count });
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

function footerLineSurface(
  text: string,
  width: number,
  background: JeditStyleToken,
  direction: I18nPort['direction'],
): { readonly surface: Surface; readonly x: number } {
  const content = footerLineContent(text, width);
  const contentWidth = Math.max(MIN_FOOTER_CONTENT_WIDTH, Math.min(width, [...content].length));
  const lineSurface = stringToSurface(fitLine(content, contentWidth), contentWidth, FOOTER_LINE_HEIGHT);
  applyBackground(lineSurface, background);

  return {
    surface: lineSurface,
    x: direction === TEXT_DIRECTION_RTL ? width - lineSurface.width : FOOTER_ORIGIN,
  };
}

function footerLineContent(text: string, width: number): string {
  const clipped = clipToWidth(text, width).trimEnd();
  return clipped.length > 0 ? clipped : ' ';
}

function footerHasFocusablePeers(state: WorkspaceFooterState): boolean {
  return hasFocusablePeers({
    fileDrawerOpen: state.fileDrawerOpen,
    graftDrawerOpen: state.graftDrawerOpen,
    historyDrawerOpen: state.historyDrawerOpen,
    hasEditor: state.editorPath != null,
    focusPane: state.focusPane,
  });
}

function focusHint(state: WorkspaceFooterState, t: FooterHintTranslator): string | undefined {
  return footerHasFocusablePeers(state) ? t(FooterHintKeys.TabFocus) : undefined;
}

function insertTabHint(state: WorkspaceFooterState, t: FooterHintTranslator): string {
  return footerHasFocusablePeers(state) ? t(FooterHintKeys.TabFocus) : t(FooterHintKeys.TabIndent);
}

function footerHints(parts: ReadonlyArray<string | undefined>): string {
  const filtered = parts.filter((part): part is string => part != null && part.trim().length > 0);
  return `[${filtered.join(' · ')}]`;
}

function chordFooterHints(chord: string, suggestions: readonly string[]): string {
  return `${chord} [${suggestions.join(' · ')}]`;
}
