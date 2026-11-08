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
const HALVES = 2;

/** Footer segments split a row at its midpoint; the right half keeps the odd cell. */
export function halfFooterWidth(width: number): number {
  return Math.floor(width / HALVES);
}

export function footerGlobalWidth(options: FooterGlobalWidthOptions): number {
  return options.compact ? Math.min(visibleLineLength(options.summary) + GLOBAL_GAP_WIDTH, halfFooterWidth(options.width)) : 0;
}
