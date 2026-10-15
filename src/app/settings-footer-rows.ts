import { FOOTER_LAYOUT, type FooterLayout } from '../ui/footer-layout.js';
import type { JeditSettingAction, JeditSettingRowKind, JeditSettingsRow, JeditSettingsI18nState } from './settings-session.js';

interface FooterSettingsState {
  readonly footerVisible: boolean;
  readonly footerLayout?: FooterLayout;
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
