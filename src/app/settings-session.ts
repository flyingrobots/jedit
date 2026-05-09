import { JEDIT_THEME_MODE, type JeditTheme } from '../ui/jedit-theme.js';

export const JEDIT_SETTING_ACTION = {
  CycleTheme: Symbol('jedit.settings.action.cycle-theme'),
  ToggleThemeMode: Symbol('jedit.settings.action.toggle-theme-mode'),
  ToggleFooter: Symbol('jedit.settings.action.toggle-footer'),
  ToggleMarkdownPreview: Symbol('jedit.settings.action.toggle-markdown-preview'),
} as const;

export type JeditSettingAction = typeof JEDIT_SETTING_ACTION[keyof typeof JEDIT_SETTING_ACTION];

export const JEDIT_SETTING_ROW_KIND = {
  Choice: Symbol('jedit.settings.row.choice'),
  Toggle: Symbol('jedit.settings.row.toggle'),
} as const;

export type JeditSettingRowKind = typeof JEDIT_SETTING_ROW_KIND[keyof typeof JEDIT_SETTING_ROW_KIND];

export interface JeditSettingsState {
  readonly jeditTheme: JeditTheme;
  readonly footerVisible: boolean;
  readonly markdownPreviewActive: boolean;
  readonly viewMode: 'source' | 'preview';
}

export interface JeditSettingsHostState {
  readonly settingsOpen: boolean;
  readonly settingsFocusIndex: number;
}

export interface JeditSettingsKeyMsg {
  readonly key: string;
}

export interface JeditSettingsHandlers<Model, Command> {
  cycleTheme(model: Model): [Model, Command[]];
  toggleThemeMode(model: Model): [Model, Command[]];
  toggleFooter(model: Model): [Model, Command[]];
  toggleMarkdownPreview(model: Model): [Model, Command[]];
}

export interface JeditSettingsRow {
  readonly id: string;
  readonly section: string;
  readonly label: string;
  readonly description: string;
  readonly valueLabel: string;
  readonly kind: JeditSettingRowKind;
  readonly checked?: boolean;
  readonly action: JeditSettingAction;
}

const SETTINGS_SECTION_APPEARANCE = 'Appearance';
const SETTINGS_SECTION_EDITOR = 'Editor';
const ROW_ID_THEME = 'theme';
const ROW_ID_THEME_MODE = 'theme-mode';
const ROW_ID_FOOTER = 'footer';
const ROW_ID_MARKDOWN_PREVIEW = 'markdown-preview';
const VALUE_ON = 'On';
const VALUE_OFF = 'Off';
const VALUE_THEME_MODE_DARK = 'Dark';
const VALUE_THEME_MODE_LIGHT = 'Light';
const VALUE_SOURCE = 'Source';
const VALUE_PREVIEW = 'Preview';
const KEY_ESCAPE = 'escape';
const KEY_DOWN = 'down';
const KEY_UP = 'up';
const KEY_J = 'j';
const KEY_K = 'k';
const KEY_ENTER = 'enter';
const KEY_SPACE = ' ';
const KEY_SPACE_CANONICAL = 'space';
const FOCUS_STEP_FORWARD = 1;
const FOCUS_STEP_BACKWARD = -1;

export function jeditSettingsRows(state: JeditSettingsState): readonly JeditSettingsRow[] {
  const rows: JeditSettingsRow[] = [
    {
      id: ROW_ID_THEME,
      section: SETTINGS_SECTION_APPEARANCE,
      label: 'Theme',
      description: 'Switch between installed data-driven themes.',
      valueLabel: state.jeditTheme.name,
      kind: JEDIT_SETTING_ROW_KIND.Choice,
      action: JEDIT_SETTING_ACTION.CycleTheme,
    },
    {
      id: ROW_ID_THEME_MODE,
      section: SETTINGS_SECTION_APPEARANCE,
      label: 'Light/dark',
      description: 'Switch the current theme to its light or dark companion.',
      valueLabel: settingsThemeModeLabel(state.jeditTheme),
      kind: JEDIT_SETTING_ROW_KIND.Choice,
      action: JEDIT_SETTING_ACTION.ToggleThemeMode,
    },
    {
      id: ROW_ID_FOOTER,
      section: SETTINGS_SECTION_APPEARANCE,
      label: 'Footer',
      description: 'Show mode, focus, and command hints at the bottom edge.',
      valueLabel: state.footerVisible ? VALUE_ON : VALUE_OFF,
      kind: JEDIT_SETTING_ROW_KIND.Toggle,
      checked: state.footerVisible,
      action: JEDIT_SETTING_ACTION.ToggleFooter,
    },
  ];

  if (state.markdownPreviewActive) {
    rows.push({
      id: ROW_ID_MARKDOWN_PREVIEW,
      section: SETTINGS_SECTION_EDITOR,
      label: 'Markdown preview',
      description: 'Switch the active Markdown buffer between source and preview.',
      valueLabel: state.viewMode === 'preview' ? VALUE_PREVIEW : VALUE_SOURCE,
      kind: JEDIT_SETTING_ROW_KIND.Choice,
      action: JEDIT_SETTING_ACTION.ToggleMarkdownPreview,
    });
  }

  return rows;
}

function settingsThemeModeLabel(theme: JeditTheme): string {
  return theme.mode === JEDIT_THEME_MODE.Light ? VALUE_THEME_MODE_LIGHT : VALUE_THEME_MODE_DARK;
}

export function moveSettingsFocusIndex(index: number, delta: number, rowCount: number): number {
  return clampSettingsFocusIndex(index + delta, rowCount);
}

export function clampSettingsFocusIndex(index: number, rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, rowCount - 1));
}

export function toggleSettingsOpen<Model extends JeditSettingsHostState>(model: Model): Model {
  return {
    ...model,
    settingsOpen: !model.settingsOpen,
    settingsFocusIndex: 0,
  };
}

export function updateJeditSettingsFromKey<Model extends JeditSettingsHostState, Command>(
  msg: JeditSettingsKeyMsg,
  model: Model,
  rows: readonly JeditSettingsRow[],
  handlers: JeditSettingsHandlers<Model, Command>,
): [Model, Command[]] {
  if (msg.key === KEY_ESCAPE) {
    return [{ ...model, settingsOpen: false }, []];
  }
  if (msg.key === KEY_DOWN || msg.key === KEY_J) {
    return [moveHostFocus(model, FOCUS_STEP_FORWARD, rows.length), []];
  }
  if (msg.key === KEY_UP || msg.key === KEY_K) {
    return [moveHostFocus(model, FOCUS_STEP_BACKWARD, rows.length), []];
  }
  if (msg.key === KEY_ENTER || msg.key === KEY_SPACE || msg.key === KEY_SPACE_CANONICAL) {
    return activateSettingsRow(model, rows[clampSettingsFocusIndex(model.settingsFocusIndex, rows.length)]?.action, handlers);
  }
  return [model, []];
}

function moveHostFocus<Model extends JeditSettingsHostState>(model: Model, delta: number, rowCount: number): Model {
  return {
    ...model,
    settingsFocusIndex: moveSettingsFocusIndex(model.settingsFocusIndex, delta, rowCount),
  };
}

function activateSettingsRow<Model, Command>(
  model: Model,
  action: JeditSettingAction | undefined,
  handlers: JeditSettingsHandlers<Model, Command>,
): [Model, Command[]] {
  if (action === JEDIT_SETTING_ACTION.CycleTheme) {
    return handlers.cycleTheme(model);
  }
  if (action === JEDIT_SETTING_ACTION.ToggleThemeMode) {
    return handlers.toggleThemeMode(model);
  }
  if (action === JEDIT_SETTING_ACTION.ToggleFooter) {
    return handlers.toggleFooter(model);
  }
  if (action === JEDIT_SETTING_ACTION.ToggleMarkdownPreview) {
    return handlers.toggleMarkdownPreview(model);
  }
  return [model, []];
}
