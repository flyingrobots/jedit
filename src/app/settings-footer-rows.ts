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
const COPY = Object.freeze({
  FooterLabel: 'settings.rows.footer.label',
  FooterDescription: 'settings.rows.footer.description',
  LayoutLabel: 'settings.rows.footer_layout.label',
  LayoutDescription: 'settings.rows.footer_layout.description',
  FilepathsLabel: 'settings.rows.filepaths.label',
  FilepathsDescription: 'settings.rows.filepaths.description',
  PathsAbsolute: 'settings.values.paths_absolute',
  PathsGitRoot: 'settings.values.paths_git_root',
} as const);
const ROW_IDS = Object.freeze({ Footer: 'footer', FooterLayout: 'footer-layout', Filepaths: 'filepaths' } as const);
const LAYOUT_LABELS: Readonly<Record<FooterLayout, string>> = {
  [FOOTER_LAYOUT.Focused]: 'settings.values.footer_focused',
  [FOOTER_LAYOUT.PerPane]: 'settings.values.footer_per_pane',
  [FOOTER_LAYOUT.Compact]: 'settings.values.footer_compact',
};

export function footerVisibilityRow(state: FooterSettingsState, action: JeditSettingAction, kind: JeditSettingRowKind): JeditSettingsRow {
  return {
    id: ROW_IDS.Footer, section: state.i18n.t(SECTION), label: state.i18n.t(COPY.FooterLabel),
    description: state.i18n.t(COPY.FooterDescription),
    valueLabel: state.i18n.t(state.footerVisible ? ON : OFF), kind, checked: state.footerVisible, action,
  };
}

export function footerLayoutRow(state: FooterSettingsState, action: JeditSettingAction, kind: JeditSettingRowKind): JeditSettingsRow {
  const valueLabel = state.i18n.t(LAYOUT_LABELS[state.footerLayout ?? FOOTER_LAYOUT.Focused]);
  return {
    id: ROW_IDS.FooterLayout, section: state.i18n.t(SECTION), label: state.i18n.t(COPY.LayoutLabel),
    description: state.i18n.t(COPY.LayoutDescription, { layout: valueLabel }),
    valueLabel, kind, action,
  };
}

export function filepathStyleRow(state: FooterSettingsState, action: JeditSettingAction, kind: JeditSettingRowKind): JeditSettingsRow {
  const valueLabel = state.i18n.t(state.filepathStyle === FILEPATH_STYLE.Absolute ? COPY.PathsAbsolute : COPY.PathsGitRoot);
  return {
    id: ROW_IDS.Filepaths, section: state.i18n.t(SECTION), label: state.i18n.t(COPY.FilepathsLabel),
    description: state.i18n.t(COPY.FilepathsDescription, { style: valueLabel }),
    valueLabel, kind, action,
  };
}
