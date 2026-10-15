import { visibleLineLength } from './fit-line.js';
import { FOOTER_LAYOUT, type FooterLayout } from '../ports/footer-preferences.js';
export { FOOTER_LAYOUT, nextFooterLayout, type FooterLayout } from '../ports/footer-preferences.js';
const TWO_ROWS = 2;
const ONE_ROW = 1;

export function footerLayoutRows(layout?: FooterLayout): number {
  return layout === FOOTER_LAYOUT.Compact ? ONE_ROW : TWO_ROWS;
}

export interface FooterGlobalWidthOptions {
  readonly width: number;
  readonly summary: string;
  readonly compact: boolean;
}
const GLOBAL_GAP_WIDTH = 2;
export function footerGlobalWidth(options: FooterGlobalWidthOptions): number {
  return options.compact ? Math.min(visibleLineLength(options.summary) + GLOBAL_GAP_WIDTH, Math.floor(options.width / 2)) : 0;
}
