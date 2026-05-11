import {
  jeditSettingsRows,
  type JeditSettingsHandlers,
} from '../settings-session.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { type WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { nextJeditTheme, oppositeJeditTheme } from '../../ui/jedit-themes.js';

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
  cycleTheme: (model) => ({
    ...model,
    jeditTheme: nextJeditTheme(model.jeditTheme),
  }, []),
  toggleThemeMode: (model) => ({
    ...model,
    jeditTheme: oppositeJeditTheme(model.jeditTheme),
  }, []),
  toggleFooter: (model) => ({
    ...model,
    footerVisible: !model.footerVisible,
  }, []),
  toggleMarkdownPreview: (model) => {
    let preview = model;
    if (model.editor == null || !isWorkspaceMarkdownFile(model.editor.path)) {
      return [model, []];
    }
    const nextMode = model.viewMode === 'source' ? 'preview' : 'source';
    preview = { ...model, viewMode: nextMode };
    return [preview, []];
  },
  toggleLocale: (model) => {
    const nextLocale = model.i18n.locale === 'en' ? 'me' : 'en';
    const nextDirection = nextLocale === 'me' ? 'rtl' : 'ltr';
    model.i18n.setLocale(nextLocale, nextDirection);
    return [model, []];
  },
};
