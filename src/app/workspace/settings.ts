import {
  jeditSettingsRows,
  type JeditSettingsLocaleSelection,
  type JeditSettingsHandlers,
} from '../settings-session.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { type WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { nextJeditTheme, oppositeJeditTheme } from '../../ui/jedit-themes.js';
import { ViewModes } from './view-mode.js';

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
    viewMode: model.viewMode,
  });
}

export const workspaceSettingsHandlers: JeditSettingsHandlers<WorkspaceModel, WorkspaceMsg> = {
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
  toggleMarkdownPreview: (model) => {
    let preview = model;
    if (model.editor == null || !isWorkspaceMarkdownFile(model.editor.path)) {
      return [model, []];
    }
    const nextMode = model.viewMode === ViewModes.Source ? ViewModes.Preview : ViewModes.Source;
    preview = { ...model, viewMode: nextMode };
    return [preview, []];
  },
  selectLocale: (model, locale) => {
    return [applyWorkspaceLocale(model, locale), []];
  },
};

function applyWorkspaceLocale(model: WorkspaceModel, locale: JeditSettingsLocaleSelection): WorkspaceModel {
  return {
    ...model,
    i18n: model.i18n.withLocale(locale.locale),
  };
}
