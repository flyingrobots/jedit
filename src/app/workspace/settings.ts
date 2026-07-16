import {
  jeditSettingsRows,
  type JeditSettingsActivationDelta,
  type JeditSettingsLocaleSelection,
  type JeditSettingsHandlers,
} from '../settings-session.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { ensureEditorVisible, editorViewport, isWorkspaceMarkdownFile } from './editor-session.js';
import { beginGraftDiagnosticsRefresh } from './graft-diagnostics.js';
import { type WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { nextJeditTheme, oppositeJeditTheme } from '../../ui/jedit-themes.js';
import { ViewModes } from './view-mode.js';
import type { GraftDiagnosticsPort } from '../../ports/graft-diagnostics.js';
import { nextSourceLineNumberMode } from '../../ui/source-line-number-mode.js';
import type { ProductionTextSession } from './production-text-session.js';
import { beginWorkspaceCausalLineChangeRefresh } from './workspace-causal-line-change-refresh.js';
import { nextWorkspaceCausalGutterBasis } from './workspace-causal-gutter-basis.js';

export const WorkspaceLocales = Object.freeze({
  Default: 'en',
  Alternate: 'me',
} as const);

export const WorkspaceTextDirections = Object.freeze({
  Ltr: 'ltr',
  Rtl: 'rtl',
} as const);

export function settingsRows(model: WorkspaceModel): ReturnType<typeof jeditSettingsRows> {
  return jeditSettingsRows({
    i18n: model.i18n,
    jeditTheme: model.jeditTheme,
    footerVisible: model.footerVisible,
    lineNumberMode: model.lineNumberMode,
    gutterDimmed: model.gutterDimmed,
    causalGutterBasis: model.causalGutterBasis,
    markdownPreviewActive: model.editor != null && isWorkspaceMarkdownFile(model.editor.path),
    diagnosticsAvailable: true,
    viewMode: model.viewMode,
  });
}

export interface WorkspaceSettingsHandlerContext {
  readonly graftDiagnostics?: GraftDiagnosticsPort;
  readonly productionTextSession?: ProductionTextSession;
}

export function workspaceSettingsHandlers(
  context: WorkspaceSettingsHandlerContext = {},
): JeditSettingsHandlers<WorkspaceModel, WorkspaceMsg> {
  return {
    cycleTheme: (model) => ([{
      ...model,
      jeditTheme: nextJeditTheme(model.jeditTheme),
    }, []]),
    toggleThemeMode: (model) => ([{
      ...model,
      jeditTheme: oppositeJeditTheme(model.jeditTheme),
    }, []]),
    toggleFooter: (model) => ([{
      ...model,
      footerVisible: !model.footerVisible,
    }, []]),
    toggleLineNumberMode: (model) => toggleWorkspaceLineNumberMode(model),
    toggleGutterDimmed: (model) => ([{
      ...model,
      gutterDimmed: !model.gutterDimmed,
    }, []]),
    cycleCausalGutterBasis: (model, delta) => cycleWorkspaceCausalGutterBasis(model, delta, context),
    toggleMarkdownPreview: (model) => toggleWorkspaceMarkdownPreview(model),
    openDiagnostics: (model) => openWorkspaceDiagnostics(model, context),
    cycleLocale: (model, delta) => cycleWorkspaceLocale(model, delta),
    selectLocale: (model, locale) => [applyWorkspaceLocale(model, locale), []],
  };
}

function cycleWorkspaceCausalGutterBasis(
  model: WorkspaceModel,
  delta: JeditSettingsActivationDelta,
  context: WorkspaceSettingsHandlerContext,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const next = {
    ...model,
    causalGutterBasis: nextWorkspaceCausalGutterBasis(
      model.causalGutterBasis,
      delta,
      model.echoHistory,
      model.echoHistorySelectedIndex,
    ),
  };
  return context.productionTextSession == null
    ? [next, []]
    : beginWorkspaceCausalLineChangeRefresh(next, context.productionTextSession);
}

function toggleWorkspaceLineNumberMode(model: WorkspaceModel): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const next: WorkspaceModel = {
    ...model,
    lineNumberMode: nextSourceLineNumberMode(model.lineNumberMode),
  };
  if (next.editor == null) {
    return [next, []];
  }
  const viewport = editorViewport(next);
  return [{
    ...next,
    editor: ensureEditorVisible(next.editor, viewport.width, viewport.height),
  }, []];
}

function applyWorkspaceLocale(model: WorkspaceModel, locale: JeditSettingsLocaleSelection): WorkspaceModel {
  return {
    ...model,
    i18n: model.i18n.withLocale(locale.locale),
  };
}

function cycleWorkspaceLocale(
  model: WorkspaceModel,
  delta: JeditSettingsActivationDelta,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const locales = model.i18n.locales;
  if (locales.length === 0) {
    return [model, []];
  }
  const index = locales.findIndex((locale) => locale.locale === model.i18n.locale);
  const currentIndex = index < 0 ? 0 : index;
  const nextIndex = positiveModulo(currentIndex + delta, locales.length);
  const nextLocale = locales[nextIndex] ?? locales[currentIndex];
  return nextLocale == null ? [model, []] : [applyWorkspaceLocale(model, nextLocale), []];
}

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function toggleWorkspaceMarkdownPreview(model: WorkspaceModel): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null || !isWorkspaceMarkdownFile(model.editor.path)) {
    return [model, []];
  }
  const nextMode = model.viewMode === ViewModes.Source ? ViewModes.Preview : ViewModes.Source;
  return [{ ...model, viewMode: nextMode }, []];
}

function openWorkspaceDiagnostics(
  model: WorkspaceModel,
  context: WorkspaceSettingsHandlerContext,
): ReturnType<JeditSettingsHandlers<WorkspaceModel, WorkspaceMsg>['openDiagnostics']> {
  return context.graftDiagnostics == null
    ? [model, []]
    : beginGraftDiagnosticsRefresh(model, context.graftDiagnostics);
}
