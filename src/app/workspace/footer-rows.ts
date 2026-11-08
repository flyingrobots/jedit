import { FOOTER_LAYOUT, type FooterLayout } from '../../ports/footer-preferences.js';
import { FocusPanes, type FocusPane } from '../../ports/workspace-focus.js';

const TWO_ROWS = 2;
const ONE_ROW = 1;
const NO_ROWS = 0;

/** Rows a visible footer reserves for each layout. */
export function footerLayoutRows(layout?: FooterLayout): number {
  return layout === FOOTER_LAYOUT.Compact ? ONE_ROW : TWO_ROWS;
}

export interface FooterRowsState {
  readonly footerVisible: boolean;
  readonly footerLayout?: FooterLayout;
  readonly fileSearchEditing?: boolean;
  readonly fileDrawerOpen?: boolean;
  readonly focusPane?: FocusPane;
}

/** A hidden footer reserves one row only while the Files filter prompt owns input. */
export function footerRowsFor(state: FooterRowsState): number {
  if (state.footerVisible) return footerLayoutRows(state.footerLayout);
  const filterOwnsInput = state.fileSearchEditing === true && state.fileDrawerOpen === true && state.focusPane === FocusPanes.Files;
  return filterOwnsInput ? ONE_ROW : NO_ROWS;
}
