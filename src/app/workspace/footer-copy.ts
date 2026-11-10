import { LEADER_SETTINGS_COPY } from '../leader-settings-row.js';

/** i18n keys the footer and the Files explorer share. */
export const FOOTER_COPY = Object.freeze({
  Files: 'footer.mode.files', Graft: 'footer.mode.graft', Preview: 'footer.mode.preview', Browse: 'footer.mode.browse',
  Settings: 'footer.mode.settings', Filter: 'footer.status.filter', FilterHint: 'footer.hints.slash_filter',
  Nav: 'footer.status.nav', Loading: 'footer.status.loading', ReadOnly: 'footer.status.read_only',
  Modified: 'footer.status.modified', StartupTitle: 'startupFileModal.title',
  LeaderCapture: LEADER_SETTINGS_COPY.Capture,
} as const);
