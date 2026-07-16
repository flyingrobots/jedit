import type { Cmd } from '@flyingrobots/bijou-tui';
import type { I18nDirection } from '../ports/i18n.js';
import { JEDIT_THEME_MODE, type JeditTheme } from '../ui/jedit-theme.js';
import {
  SOURCE_LINE_NUMBER_MODE,
  type SourceLineNumberMode,
} from '../ui/source-line-number-mode.js';
import { JEDIT_SETTINGS_CLOSE_KEY } from './keybindings.js';
import {
  WorkspaceCausalGutterBasisKinds,
  type WorkspaceCausalGutterBasis,
} from './workspace/workspace-causal-gutter-basis.js';
import { ViewModes, type ViewMode } from './workspace/view-mode.js';

export const JEDIT_SETTING_ACTION = {
  CycleTheme: Symbol('jedit.settings.action.cycle-theme'),
  ToggleThemeMode: Symbol('jedit.settings.action.toggle-theme-mode'),
  ToggleFooter: Symbol('jedit.settings.action.toggle-footer'),
  ToggleLineNumberMode: Symbol('jedit.settings.action.toggle-line-number-mode'),
  CycleCausalGutterBasis: Symbol('jedit.settings.action.cycle-causal-gutter-basis'),
  ToggleMarkdownPreview: Symbol('jedit.settings.action.toggle-markdown-preview'),
  OpenDiagnostics: Symbol('jedit.settings.action.open-diagnostics'),
  CycleLocale: Symbol('jedit.settings.action.cycle-locale'),
  SelectLocale: Symbol('jedit.settings.action.select-locale'),
} as const;

export type JeditSettingAction = typeof JEDIT_SETTING_ACTION[keyof typeof JEDIT_SETTING_ACTION];

export const JEDIT_SETTING_ROW_KIND = {
  Choice: Symbol('jedit.settings.row.choice'),
  Option: Symbol('jedit.settings.row.option'),
  Toggle: Symbol('jedit.settings.row.toggle'),
} as const;

export type JeditSettingRowKind = typeof JEDIT_SETTING_ROW_KIND[keyof typeof JEDIT_SETTING_ROW_KIND];

const SETTINGS_ACTIVATE_NEXT_DELTA = 1;
const SETTINGS_ACTIVATE_PREVIOUS_DELTA = -1;

export type JeditSettingsActivationDelta =
  | typeof SETTINGS_ACTIVATE_NEXT_DELTA
  | typeof SETTINGS_ACTIVATE_PREVIOUS_DELTA;

export interface JeditSettingsState {
  readonly jeditTheme: JeditTheme;
  readonly footerVisible: boolean;
  readonly lineNumberMode: SourceLineNumberMode;
  readonly causalGutterBasis?: WorkspaceCausalGutterBasis;
  readonly markdownPreviewActive: boolean;
  readonly diagnosticsAvailable: boolean;
  readonly viewMode: ViewMode;
}

export interface JeditSettingsI18nState {
  readonly locale: string;
  readonly localeLabel: string;
  readonly direction: I18nDirection;
  readonly locales: readonly JeditSettingsLocaleOption[];
  t(path: string, values?: Record<string, string | number>): string;
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
  toggleLineNumberMode(model: Model): [Model, Cmd<Command>[]];
  cycleCausalGutterBasis(model: Model, delta: JeditSettingsActivationDelta): [Model, Cmd<Command>[]];
  toggleMarkdownPreview(model: Model): [Model, Cmd<Command>[]];
  openDiagnostics(model: Model): [Model, Cmd<Command>[]];
  cycleLocale(model: Model, delta: JeditSettingsActivationDelta): [Model, Cmd<Command>[]];
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
const ROW_ID_LANGUAGE = 'language';
const ROW_ID_THEME = 'theme';
const ROW_ID_THEME_MODE = 'theme-mode';
const ROW_ID_FOOTER = 'footer';
const ROW_ID_LINE_NUMBERS = 'line-numbers';
const ROW_ID_CAUSAL_GUTTER_BASIS = 'causal-gutter-basis';
const ROW_ID_MARKDOWN_PREVIEW = 'markdown-preview';
const ROW_ID_DIAGNOSTICS = 'diagnostics';
const SETTINGS_LANGUAGE_LABEL = 'Language';
const KEY_ESCAPE = 'escape';
const KEY_DOWN = 'down';
const KEY_UP = 'up';
const KEY_LEFT = 'left';
const KEY_RIGHT = 'right';
const KEY_J = 'j';
const KEY_K = 'k';
const KEY_ENTER = 'enter';
const KEY_SPACE = ' ';
const KEY_SPACE_CANONICAL = 'space';
const FOCUS_STEP_FORWARD = 1;
const FOCUS_STEP_BACKWARD = -1;
const SETTINGS_I18N_KEYS = Object.freeze({
  SectionAppearance: 'settings.sections.appearance',
  SectionEditor: 'settings.sections.editor',
  SectionRuntime: 'settings.sections.runtime',
  ThemeLabel: 'settings.rows.theme.label',
  ThemeDescription: 'settings.rows.theme.description',
  ThemeModeLabel: 'settings.rows.theme_mode.label',
  ThemeModeDescription: 'settings.rows.theme_mode.description',
  FooterLabel: 'settings.rows.footer.label',
  FooterDescription: 'settings.rows.footer.description',
  LineNumbersLabel: 'settings.rows.line_numbers.label',
  LineNumbersDescription: 'settings.rows.line_numbers.description',
  CausalGutterBasisLabel: 'settings.rows.causal_gutter_basis.label',
  CausalGutterBasisDescription: 'settings.rows.causal_gutter_basis.description',
  MarkdownPreviewLabel: 'settings.rows.markdown_preview.label',
  MarkdownPreviewDescription: 'settings.rows.markdown_preview.description',
  DiagnosticsLabel: 'settings.rows.diagnostics.label',
  DiagnosticsDescription: 'settings.rows.diagnostics.description',
  ValueOn: 'settings.values.on',
  ValueOff: 'settings.values.off',
  ValueThemeModeDark: 'settings.values.theme_mode_dark',
  ValueThemeModeLight: 'settings.values.theme_mode_light',
  ValueLineNumbersAbsolute: 'settings.values.line_numbers_absolute',
  ValueLineNumbersRelative: 'settings.values.line_numbers_relative',
  ValueCausalGutterLastSave: 'settings.values.causal_gutter_last_save',
  ValueCausalGutterImport: 'settings.values.causal_gutter_import',
  ValueCausalGutterSelectedCheckpoint: 'settings.values.causal_gutter_selected_checkpoint',
  ValueCausalGutterSelectedTick: 'settings.values.causal_gutter_selected_tick',
  ValueSource: 'settings.values.source',
  ValuePreview: 'settings.values.preview',
  ValueOpen: 'settings.values.open',
} as const);

const SETTINGS_KEY_ACTION = {
  Close: Symbol('jedit.settings.key-action.close'),
  Down: Symbol('jedit.settings.key-action.down'),
  Up: Symbol('jedit.settings.key-action.up'),
  Activate: Symbol('jedit.settings.key-action.activate'),
  ActivatePrevious: Symbol('jedit.settings.key-action.activate-previous'),
  ActivateNext: Symbol('jedit.settings.key-action.activate-next'),
} as const;

type SettingsKeyAction = typeof SETTINGS_KEY_ACTION[keyof typeof SETTINGS_KEY_ACTION];

const SETTINGS_KEY_ACTIONS = new Map<string, SettingsKeyAction>([
  [KEY_ESCAPE, SETTINGS_KEY_ACTION.Close],
  [JEDIT_SETTINGS_CLOSE_KEY, SETTINGS_KEY_ACTION.Close],
  [KEY_DOWN, SETTINGS_KEY_ACTION.Down],
  [KEY_J, SETTINGS_KEY_ACTION.Down],
  [KEY_UP, SETTINGS_KEY_ACTION.Up],
  [KEY_K, SETTINGS_KEY_ACTION.Up],
  [KEY_LEFT, SETTINGS_KEY_ACTION.ActivatePrevious],
  [KEY_RIGHT, SETTINGS_KEY_ACTION.ActivateNext],
  [KEY_ENTER, SETTINGS_KEY_ACTION.Activate],
  [KEY_SPACE, SETTINGS_KEY_ACTION.Activate],
  [KEY_SPACE_CANONICAL, SETTINGS_KEY_ACTION.Activate],
]);

type NonLocaleSettingsHandlerName =
  | 'cycleTheme'
  | 'toggleThemeMode'
  | 'toggleFooter'
  | 'toggleLineNumberMode'
  | 'toggleMarkdownPreview'
  | 'openDiagnostics';

const SETTINGS_ACTION_HANDLERS: ReadonlyMap<
  JeditSettingAction,
  NonLocaleSettingsHandlerName
> = new Map([
  [JEDIT_SETTING_ACTION.CycleTheme, 'cycleTheme'],
  [JEDIT_SETTING_ACTION.ToggleThemeMode, 'toggleThemeMode'],
  [JEDIT_SETTING_ACTION.ToggleFooter, 'toggleFooter'],
  [JEDIT_SETTING_ACTION.ToggleLineNumberMode, 'toggleLineNumberMode'],
  [JEDIT_SETTING_ACTION.ToggleMarkdownPreview, 'toggleMarkdownPreview'],
  [JEDIT_SETTING_ACTION.OpenDiagnostics, 'openDiagnostics'],
]);

type JeditSettingsContext = JeditSettingsState & { readonly i18n: JeditSettingsI18nState };

export function jeditSettingsRows(state: JeditSettingsContext): readonly JeditSettingsRow[] {
  const rows: JeditSettingsRow[] = [
    languageSettingsRow(state.i18n),
    themeSettingsRow(state),
    themeModeSettingsRow(state),
    footerSettingsRow(state),
    lineNumbersSettingsRow(state),
    causalGutterBasisSettingsRow(state),
  ];

  if (state.markdownPreviewActive) {
    rows.push(markdownPreviewSettingsRow(state));
  }
  if (state.diagnosticsAvailable) {
    rows.push(diagnosticsSettingsRow(state.i18n));
  }

  return rows;
}

function languageSettingsRow(
  i18n: JeditSettingsI18nState,
): JeditSettingsRow {
  const active = activeSettingsLocale(i18n);
  const index = settingsLocaleIndex(i18n);
  return {
    id: ROW_ID_LANGUAGE,
    section: SETTINGS_SECTION_LANGUAGE,
    label: SETTINGS_LANGUAGE_LABEL,
    description: `${active.locale} ${active.direction.toUpperCase()}`,
    valueLabel: `< ${active.label} > ${index + 1}/${settingsLocaleCount(i18n)}`,
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.CycleLocale,
  };
}

function activeSettingsLocale(i18n: JeditSettingsI18nState): JeditSettingsLocaleOption {
  return i18n.locales.find((locale) => locale.locale === i18n.locale) ?? {
    locale: i18n.locale,
    label: i18n.localeLabel,
    direction: i18n.direction,
  };
}

function settingsLocaleIndex(i18n: JeditSettingsI18nState): number {
  const index = i18n.locales.findIndex((locale) => locale.locale === i18n.locale);
  return index < 0 ? 0 : index;
}

function settingsLocaleCount(i18n: JeditSettingsI18nState): number {
  return Math.max(1, i18n.locales.length);
}

function themeSettingsRow(state: JeditSettingsContext): JeditSettingsRow {
  return {
    id: ROW_ID_THEME,
    section: state.i18n.t(SETTINGS_I18N_KEYS.SectionAppearance),
    label: state.i18n.t(SETTINGS_I18N_KEYS.ThemeLabel),
    description: state.i18n.t(SETTINGS_I18N_KEYS.ThemeDescription),
    valueLabel: state.jeditTheme.name,
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.CycleTheme,
  };
}

function themeModeSettingsRow(state: JeditSettingsContext): JeditSettingsRow {
  return {
    id: ROW_ID_THEME_MODE,
    section: state.i18n.t(SETTINGS_I18N_KEYS.SectionAppearance),
    label: state.i18n.t(SETTINGS_I18N_KEYS.ThemeModeLabel),
    description: state.i18n.t(SETTINGS_I18N_KEYS.ThemeModeDescription),
    valueLabel: settingsThemeModeLabel(state),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.ToggleThemeMode,
  };
}

function footerSettingsRow(state: JeditSettingsContext): JeditSettingsRow {
  return {
    id: ROW_ID_FOOTER,
    section: state.i18n.t(SETTINGS_I18N_KEYS.SectionAppearance),
    label: state.i18n.t(SETTINGS_I18N_KEYS.FooterLabel),
    description: state.i18n.t(SETTINGS_I18N_KEYS.FooterDescription),
    valueLabel: state.footerVisible ? state.i18n.t(SETTINGS_I18N_KEYS.ValueOn) : state.i18n.t(SETTINGS_I18N_KEYS.ValueOff),
    kind: JEDIT_SETTING_ROW_KIND.Toggle,
    checked: state.footerVisible,
    action: JEDIT_SETTING_ACTION.ToggleFooter,
  };
}

function lineNumbersSettingsRow(state: JeditSettingsContext): JeditSettingsRow {
  return {
    id: ROW_ID_LINE_NUMBERS,
    section: state.i18n.t(SETTINGS_I18N_KEYS.SectionEditor),
    label: state.i18n.t(SETTINGS_I18N_KEYS.LineNumbersLabel),
    description: state.i18n.t(SETTINGS_I18N_KEYS.LineNumbersDescription),
    valueLabel: settingsLineNumberModeLabel(state),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.ToggleLineNumberMode,
  };
}

function causalGutterBasisSettingsRow(state: JeditSettingsContext): JeditSettingsRow {
  return {
    id: ROW_ID_CAUSAL_GUTTER_BASIS,
    section: state.i18n.t(SETTINGS_I18N_KEYS.SectionEditor),
    label: state.i18n.t(SETTINGS_I18N_KEYS.CausalGutterBasisLabel),
    description: state.i18n.t(SETTINGS_I18N_KEYS.CausalGutterBasisDescription),
    valueLabel: settingsCausalGutterBasisLabel(state),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.CycleCausalGutterBasis,
  };
}

function markdownPreviewSettingsRow(state: JeditSettingsContext): JeditSettingsRow {
  return {
    id: ROW_ID_MARKDOWN_PREVIEW,
    section: state.i18n.t(SETTINGS_I18N_KEYS.SectionEditor),
    label: state.i18n.t(SETTINGS_I18N_KEYS.MarkdownPreviewLabel),
    description: state.i18n.t(SETTINGS_I18N_KEYS.MarkdownPreviewDescription),
    valueLabel: state.viewMode === ViewModes.Preview
      ? state.i18n.t(SETTINGS_I18N_KEYS.ValuePreview)
      : state.i18n.t(SETTINGS_I18N_KEYS.ValueSource),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.ToggleMarkdownPreview,
  };
}

function diagnosticsSettingsRow(i18n: JeditSettingsI18nState): JeditSettingsRow {
  return {
    id: ROW_ID_DIAGNOSTICS,
    section: i18n.t(SETTINGS_I18N_KEYS.SectionRuntime),
    label: i18n.t(SETTINGS_I18N_KEYS.DiagnosticsLabel),
    description: i18n.t(SETTINGS_I18N_KEYS.DiagnosticsDescription),
    valueLabel: i18n.t(SETTINGS_I18N_KEYS.ValueOpen),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.OpenDiagnostics,
  };
}

function settingsThemeModeLabel(state: JeditSettingsContext): string {
  return state.jeditTheme.mode === JEDIT_THEME_MODE.Light
    ? state.i18n.t(SETTINGS_I18N_KEYS.ValueThemeModeLight)
    : state.i18n.t(SETTINGS_I18N_KEYS.ValueThemeModeDark);
}

function settingsLineNumberModeLabel(state: JeditSettingsContext): string {
  return state.lineNumberMode === SOURCE_LINE_NUMBER_MODE.Relative
    ? state.i18n.t(SETTINGS_I18N_KEYS.ValueLineNumbersRelative)
    : state.i18n.t(SETTINGS_I18N_KEYS.ValueLineNumbersAbsolute);
}

function settingsCausalGutterBasisLabel(state: JeditSettingsContext): string {
  if (state.causalGutterBasis?.kind === WorkspaceCausalGutterBasisKinds.Import) {
    return state.i18n.t(SETTINGS_I18N_KEYS.ValueCausalGutterImport);
  }
  if (state.causalGutterBasis?.kind === WorkspaceCausalGutterBasisKinds.SelectedCheckpoint) {
    return state.i18n.t(SETTINGS_I18N_KEYS.ValueCausalGutterSelectedCheckpoint);
  }
  if (state.causalGutterBasis?.kind === WorkspaceCausalGutterBasisKinds.SelectedTick) {
    return state.i18n.t(SETTINGS_I18N_KEYS.ValueCausalGutterSelectedTick);
  }
  return state.i18n.t(SETTINGS_I18N_KEYS.ValueCausalGutterLastSave);
}

export function moveSettingsFocusIndex(index: number, delta: number, rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }
  return positiveModulo(clampSettingsFocusIndex(index, rowCount) + delta, rowCount);
}

export function clampSettingsFocusIndex(index: number, rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, rowCount - 1));
}

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
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
  return activateSettingsRow(
    model,
    rows[clampSettingsFocusIndex(model.settingsFocusIndex, rows.length)],
    handlers,
    settingsActivationDelta(action),
  );
}

function settingsActivationDelta(action: SettingsKeyAction): JeditSettingsActivationDelta {
  return action === SETTINGS_KEY_ACTION.ActivatePrevious
    ? SETTINGS_ACTIVATE_PREVIOUS_DELTA
    : SETTINGS_ACTIVATE_NEXT_DELTA;
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
  delta: JeditSettingsActivationDelta,
): [Model, Cmd<Command>[]] {
  const action = row?.action;
  if (action === JEDIT_SETTING_ACTION.CycleLocale) {
    return handlers.cycleLocale(model, delta);
  }
  if (action === JEDIT_SETTING_ACTION.CycleCausalGutterBasis) {
    return handlers.cycleCausalGutterBasis(model, delta);
  }
  if (action === JEDIT_SETTING_ACTION.SelectLocale && row?.locale != null) {
    return handlers.selectLocale(model, row.locale);
  }
  const handlerName = action == null ? undefined : SETTINGS_ACTION_HANDLERS.get(action);
  return handlerName == null ? [model, []] : handlers[handlerName](model);
}
