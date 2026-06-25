import {
  jeditSettingsRows,
  type JeditSettingsLocaleSelection,
  type JeditSettingsHandlers,
} from '../settings-session.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { beginGraftDiagnosticsRefresh } from './graft-diagnostics.js';
import { type WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { nextJeditTheme, oppositeJeditTheme } from '../../ui/jedit-themes.js';
import { ViewModes } from './view-mode.js';
import type { GraftDiagnosticsPort } from '../../ports/graft-diagnostics.js';

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
    markdownPreviewActive: model.editor != null && isWorkspaceMarkdownFile(model.editor.path),
    diagnosticsAvailable: true,
    viewMode: model.viewMode,
  });
}

export interface WorkspaceSettingsHandlerContext {
  readonly graftDiagnostics?: GraftDiagnosticsPort;
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
    toggleMarkdownPreview: (model) => toggleWorkspaceMarkdownPreview(model),
    openDiagnostics: (model) => openWorkspaceDiagnostics(model, context),
    selectLocale: (model, locale) => [applyWorkspaceLocale(model, locale), []],
  };
}

function applyWorkspaceLocale(model: WorkspaceModel, locale: JeditSettingsLocaleSelection): WorkspaceModel {
  return {
    ...model,
    i18n: model.i18n.withLocale(locale.locale),
  };
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
