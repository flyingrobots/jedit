import type { Cmd } from '@flyingrobots/bijou-tui';
import type { I18nDirection } from '../ports/i18n.js';
import { JEDIT_THEME_MODE, type JeditTheme } from '../ui/jedit-theme.js';
import { ViewModes, type ViewMode } from './workspace/view-mode.js';

export const JEDIT_SETTING_ACTION = {
  CycleTheme: Symbol('jedit.settings.action.cycle-theme'),
  ToggleThemeMode: Symbol('jedit.settings.action.toggle-theme-mode'),
  ToggleFooter: Symbol('jedit.settings.action.toggle-footer'),
  ToggleMarkdownPreview: Symbol('jedit.settings.action.toggle-markdown-preview'),
  OpenDiagnostics: Symbol('jedit.settings.action.open-diagnostics'),
  SelectLocale: Symbol('jedit.settings.action.select-locale'),
} as const;

export type JeditSettingAction = typeof JEDIT_SETTING_ACTION[keyof typeof JEDIT_SETTING_ACTION];

export const JEDIT_SETTING_ROW_KIND = {
  Choice: Symbol('jedit.settings.row.choice'),
  Option: Symbol('jedit.settings.row.option'),
  Toggle: Symbol('jedit.settings.row.toggle'),
} as const;

export type JeditSettingRowKind = typeof JEDIT_SETTING_ROW_KIND[keyof typeof JEDIT_SETTING_ROW_KIND];

export interface JeditSettingsState {
  readonly jeditTheme: JeditTheme;
  readonly footerVisible: boolean;
  readonly markdownPreviewActive: boolean;
  readonly viewMode: ViewMode;
}

export interface JeditSettingsI18nState {
  readonly locale: string;
  readonly localeLabel: string;
  readonly locales: readonly JeditSettingsLocaleOption[];
}

export interface JeditSettingsLocaleSelection {
  readonly locale: string;
  readonly direction: I18nDirection;
}

export interface JeditSettingsLocaleOption extends JeditSettingsLocaleSelection {
  readonly label: string;
}

export interface JeditSettingsHostState {
  readonly settingsOpen: boolean;
  readonly settingsFocusIndex: number;
}

export interface JeditSettingsKeyMsg {
  readonly key: string;
}

export interface JeditSettingsHandlers<Model, Command> {
  cycleTheme(model: Model): [Model, Cmd<Command>[]];
  toggleThemeMode(model: Model): [Model, Cmd<Command>[]];
  toggleFooter(model: Model): [Model, Cmd<Command>[]];
  toggleMarkdownPreview(model: Model): [Model, Cmd<Command>[]];
  openDiagnostics(model: Model): [Model, Cmd<Command>[]];
  selectLocale(model: Model, locale: JeditSettingsLocaleSelection): [Model, Cmd<Command>[]];
}

export interface JeditSettingsRow {
  readonly id: string;
  readonly section: string;
  readonly label: string;
  readonly description: string;
  readonly valueLabel: string;
  readonly kind: JeditSettingRowKind;
  readonly checked?: boolean;
  readonly locale?: JeditSettingsLocaleSelection;
  readonly action: JeditSettingAction;
}

const SETTINGS_SECTION_LANGUAGE = 'Language';
const SETTINGS_SECTION_APPEARANCE = 'Appearance';
const SETTINGS_SECTION_EDITOR = 'Editor';
const SETTINGS_SECTION_RUNTIME = 'Runtime';
const ROW_ID_THEME = 'theme';
const ROW_ID_THEME_MODE = 'theme-mode';
const ROW_ID_FOOTER = 'footer';
const ROW_ID_MARKDOWN_PREVIEW = 'markdown-preview';
const ROW_ID_DIAGNOSTICS = 'diagnostics';
const ROW_ID_LOCALE_PREFIX = 'locale:';
const VALUE_ON = 'On';
const VALUE_OFF = 'Off';
const VALUE_THEME_MODE_DARK = 'Dark';
const VALUE_THEME_MODE_LIGHT = 'Light';
const VALUE_SOURCE = 'Source';
const VALUE_PREVIEW = 'Preview';
const VALUE_CURRENT = 'Current';
const VALUE_OPEN = 'Open';
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

const SETTINGS_KEY_ACTION = {
  Close: Symbol('jedit.settings.key-action.close'),
  Down: Symbol('jedit.settings.key-action.down'),
  Up: Symbol('jedit.settings.key-action.up'),
  Activate: Symbol('jedit.settings.key-action.activate'),
} as const;

type SettingsKeyAction = typeof SETTINGS_KEY_ACTION[keyof typeof SETTINGS_KEY_ACTION];

const SETTINGS_KEY_ACTIONS = new Map<string, SettingsKeyAction>([
  [KEY_ESCAPE, SETTINGS_KEY_ACTION.Close],
  [KEY_DOWN, SETTINGS_KEY_ACTION.Down],
  [KEY_J, SETTINGS_KEY_ACTION.Down],
  [KEY_UP, SETTINGS_KEY_ACTION.Up],
  [KEY_K, SETTINGS_KEY_ACTION.Up],
  [KEY_ENTER, SETTINGS_KEY_ACTION.Activate],
  [KEY_SPACE, SETTINGS_KEY_ACTION.Activate],
  [KEY_SPACE_CANONICAL, SETTINGS_KEY_ACTION.Activate],
]);

export function jeditSettingsRows(state: JeditSettingsState & { readonly i18n: JeditSettingsI18nState }): readonly JeditSettingsRow[] {
  const rows: JeditSettingsRow[] = [
    ...localeSettingsRows(state.i18n),
    themeSettingsRow(state),
    themeModeSettingsRow(state),
    footerSettingsRow(state),
  ];

  if (state.markdownPreviewActive) {
    rows.push(markdownPreviewSettingsRow(state));
  }
  rows.push(diagnosticsSettingsRow());

  return rows;
}

function localeSettingsRows(i18n: JeditSettingsI18nState): readonly JeditSettingsRow[] {
  return i18n.locales.map((locale) => localeSettingsRow(i18n, locale));
}

function localeSettingsRow(
  i18n: JeditSettingsI18nState,
  locale: JeditSettingsLocaleOption,
): JeditSettingsRow {
  const active = locale.locale === i18n.locale;
  return {
    id: `${ROW_ID_LOCALE_PREFIX}${locale.locale}`,
    section: SETTINGS_SECTION_LANGUAGE,
    label: locale.label,
    description: `${locale.locale} ${locale.direction.toUpperCase()}`,
    valueLabel: active ? VALUE_CURRENT : locale.locale,
    kind: JEDIT_SETTING_ROW_KIND.Option,
    checked: active,
    locale,
    action: JEDIT_SETTING_ACTION.SelectLocale,
  };
}

function themeSettingsRow(state: JeditSettingsState): JeditSettingsRow {
  return {
    id: ROW_ID_THEME,
    section: SETTINGS_SECTION_APPEARANCE,
    label: 'Theme',
    description: 'Switch between installed data-driven themes.',
    valueLabel: state.jeditTheme.name,
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.CycleTheme,
  };
}

function themeModeSettingsRow(state: JeditSettingsState): JeditSettingsRow {
  return {
    id: ROW_ID_THEME_MODE,
    section: SETTINGS_SECTION_APPEARANCE,
    label: 'Light/dark',
    description: 'Switch the current theme to its light or dark companion.',
    valueLabel: settingsThemeModeLabel(state.jeditTheme),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.ToggleThemeMode,
  };
}

function footerSettingsRow(state: JeditSettingsState): JeditSettingsRow {
  return {
    id: ROW_ID_FOOTER,
    section: SETTINGS_SECTION_APPEARANCE,
    label: 'Footer',
    description: 'Show mode, focus, and command hints at the bottom edge.',
    valueLabel: state.footerVisible ? VALUE_ON : VALUE_OFF,
    kind: JEDIT_SETTING_ROW_KIND.Toggle,
    checked: state.footerVisible,
    action: JEDIT_SETTING_ACTION.ToggleFooter,
  };
}

function markdownPreviewSettingsRow(state: JeditSettingsState): JeditSettingsRow {
  return {
    id: ROW_ID_MARKDOWN_PREVIEW,
    section: SETTINGS_SECTION_EDITOR,
    label: 'Markdown preview',
    description: 'Switch the active Markdown buffer between source and preview.',
    valueLabel: state.viewMode === ViewModes.Preview ? VALUE_PREVIEW : VALUE_SOURCE,
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.ToggleMarkdownPreview,
  };
}

function diagnosticsSettingsRow(): JeditSettingsRow {
  return {
    id: ROW_ID_DIAGNOSTICS,
    section: SETTINGS_SECTION_RUNTIME,
    label: 'Diagnostics',
    description: 'Inspect Graft, parser, and Colorful runtime wiring.',
    valueLabel: VALUE_OPEN,
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.OpenDiagnostics,
  };
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
): [Model, Cmd<Command>[]] {
  const action = settingsKeyAction(msg.key);
  return action == null
    ? [model, []]
    : reduceSettingsKeyAction(action, model, rows, handlers);
}

function settingsKeyAction(key: string): SettingsKeyAction | undefined {
  return SETTINGS_KEY_ACTIONS.get(key);
}

function reduceSettingsKeyAction<Model extends JeditSettingsHostState, Command>(
  action: SettingsKeyAction,
  model: Model,
  rows: readonly JeditSettingsRow[],
  handlers: JeditSettingsHandlers<Model, Command>,
): [Model, Cmd<Command>[]] {
  if (action === SETTINGS_KEY_ACTION.Close) {
    return [{ ...model, settingsOpen: false }, []];
  }
  if (action === SETTINGS_KEY_ACTION.Down) {
    return [moveHostFocus(model, FOCUS_STEP_FORWARD, rows.length), []];
  }
  if (action === SETTINGS_KEY_ACTION.Up) {
    return [moveHostFocus(model, FOCUS_STEP_BACKWARD, rows.length), []];
  }
  return activateSettingsRow(model, rows[clampSettingsFocusIndex(model.settingsFocusIndex, rows.length)], handlers);
}

function moveHostFocus<Model extends JeditSettingsHostState>(model: Model, delta: number, rowCount: number): Model {
  return {
    ...model,
    settingsFocusIndex: moveSettingsFocusIndex(model.settingsFocusIndex, delta, rowCount),
  };
}

function activateSettingsRow<Model, Command>(
  model: Model,
  row: JeditSettingsRow | undefined,
  handlers: JeditSettingsHandlers<Model, Command>,
): [Model, Cmd<Command>[]] {
  const action = row?.action;
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
  if (action === JEDIT_SETTING_ACTION.OpenDiagnostics) {
    return handlers.openDiagnostics(model);
  }
  if (action === JEDIT_SETTING_ACTION.SelectLocale && row?.locale != null) {
    return handlers.selectLocale(model, row.locale);
  }
  return [model, []];
}
