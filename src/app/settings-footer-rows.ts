import { FILEPATH_STYLE, type FilepathStyle } from '../ports/filepath-style.js';
import { FOOTER_LAYOUT, type FooterLayout } from '../ports/footer-preferences.js';
import type { JeditSettingAction, JeditSettingRowKind, JeditSettingsRow, JeditSettingsI18nState } from './settings-session.js';

interface FooterSettingsState {
  readonly footerVisible: boolean;
  readonly footerLayout?: FooterLayout;
  readonly filepathStyle?: FilepathStyle;
  readonly i18n: JeditSettingsI18nState;
}
const SECTION = 'settings.sections.appearance';
const ON = 'settings.values.on';
const OFF = 'settings.values.off';
const LAYOUT_LABELS: Readonly<Record<FooterLayout, string>> = {
  [FOOTER_LAYOUT.Focused]: 'settings.values.footer_focused',
  [FOOTER_LAYOUT.PerPane]: 'settings.values.footer_per_pane',
  [FOOTER_LAYOUT.Compact]: 'settings.values.footer_compact',
};

export function footerVisibilityRow(state: FooterSettingsState, action: JeditSettingAction, kind: JeditSettingRowKind): JeditSettingsRow {
  return {
    id: 'footer', section: state.i18n.t(SECTION), label: state.i18n.t('settings.rows.footer.label'),
    description: state.i18n.t('settings.rows.footer.description'),
    valueLabel: state.i18n.t(state.footerVisible ? ON : OFF), kind, checked: state.footerVisible, action,
  };
}

export function footerLayoutRow(state: FooterSettingsState, action: JeditSettingAction, kind: JeditSettingRowKind): JeditSettingsRow {
  const valueLabel = state.i18n.t(LAYOUT_LABELS[state.footerLayout ?? FOOTER_LAYOUT.Focused]);
  return {
    id: 'footer-layout', section: state.i18n.t(SECTION), label: state.i18n.t('settings.rows.footer_layout.label'),
    description: state.i18n.t('settings.rows.footer_layout.description', { layout: valueLabel }),
    valueLabel, kind, action,
  };
}

export function filepathStyleRow(state: FooterSettingsState, action: JeditSettingAction, kind: JeditSettingRowKind): JeditSettingsRow {
  const valueLabel = state.i18n.t(state.filepathStyle === FILEPATH_STYLE.Absolute
    ? 'settings.values.paths_absolute' : 'settings.values.paths_git_root');
  return {
    id: 'filepaths', section: state.i18n.t(SECTION), label: state.i18n.t('settings.rows.filepaths.label'),
    description: state.i18n.t('settings.rows.filepaths.description', { style: valueLabel }),
    valueLabel,
    kind, action,
  };
}
