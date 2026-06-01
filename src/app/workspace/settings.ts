import {
  jeditSettingsRows,
  type JeditSettingsHandlers,
} from '../settings-session.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { type WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { I18nLocaleOption } from '../../ports/i18n.js';
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

const FALLBACK_LOCALE_OPTION: I18nLocaleOption = {
  locale: WorkspaceLocales.Default,
  label: 'English',
  direction: WorkspaceTextDirections.Ltr,
};

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
  toggleLocale: (model) => {
    const nextLocale = nextWorkspaceLocale(model.i18n.locale, model.i18n.locales);
    model.i18n.setLocale(nextLocale.locale, nextLocale.direction);
    return [model, []];
  },
};

function nextWorkspaceLocale(currentLocale: string, locales: readonly I18nLocaleOption[]): I18nLocaleOption {
  if (locales.length === 0) {
    return FALLBACK_LOCALE_OPTION;
  }

  const currentIndex = locales.findIndex((locale) => locale.locale === currentLocale);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % locales.length;
  return locales[nextIndex] ?? FALLBACK_LOCALE_OPTION;
}
