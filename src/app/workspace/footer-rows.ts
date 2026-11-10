import { FOOTER_LAYOUT, type FooterLayout } from '../../ports/footer-preferences.js';
import { fileSearchHasFocus, type FileExplorerFocusState } from './file-search.js';

const TWO_ROWS = 2;
const ONE_ROW = 1;
const NO_ROWS = 0;

/** Rows a visible footer reserves for each layout. */
export function footerLayoutRows(layout?: FooterLayout): number {
  return layout === FOOTER_LAYOUT.Compact ? ONE_ROW : TWO_ROWS;
}

export interface FooterRowsState extends FileExplorerFocusState {
  readonly footerVisible: boolean;
  readonly footerLayout?: FooterLayout;
}

/**
 * A hidden footer reserves one row only while the Files filter prompt owns
 * input, by the same predicate the footer presentation uses to paint it.
 */
export function footerRowsFor(state: FooterRowsState): number {
  if (state.footerVisible) return footerLayoutRows(state.footerLayout);
  return fileSearchHasFocus(state) ? ONE_ROW : NO_ROWS;
}
