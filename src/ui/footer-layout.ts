import { FOOTER_LAYOUT, type FooterLayout } from '../ports/footer-preferences.js';
export { FOOTER_LAYOUT, type FooterLayout } from '../ports/footer-preferences.js';
const LAYOUTS: readonly FooterLayout[] = Object.values(FOOTER_LAYOUT);
const TWO_ROWS = 2;
const ONE_ROW = 1;

export function nextFooterLayout(layout: FooterLayout | undefined, delta: number): FooterLayout {
  const index = Math.max(0, LAYOUTS.indexOf(layout ?? FOOTER_LAYOUT.Focused));
  return LAYOUTS[((index + delta) % LAYOUTS.length + LAYOUTS.length) % LAYOUTS.length] ?? FOOTER_LAYOUT.Focused;
}

export function footerLayoutRows(layout?: FooterLayout): number {
  return layout === FOOTER_LAYOUT.Compact ? ONE_ROW : TWO_ROWS;
}
