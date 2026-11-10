import type { FilepathStyle } from './filepath-style.js';
export const FOOTER_LAYOUT = Object.freeze({
  Focused: 'focused', PerPane: 'per-pane', Compact: 'compact',
} as const);
export type FooterLayout = typeof FOOTER_LAYOUT[keyof typeof FOOTER_LAYOUT];

export type FooterPreferenceSave = { readonly ok: true } | { readonly ok: false };

/** Application preferences live outside authoritative text and its causal history. */
export interface FooterPreferencesPort {
  loadLayout(): FooterLayout;
  saveLayout(layout: FooterLayout): FooterPreferenceSave;
  loadFilepaths(): FilepathStyle;
  saveFilepaths(style: FilepathStyle): FooterPreferenceSave;
}

const LAYOUTS: readonly FooterLayout[] = Object.values(FOOTER_LAYOUT);
export function nextFooterLayout(layout: FooterLayout | undefined, delta: number): FooterLayout {
  const index = Math.max(0, LAYOUTS.indexOf(layout ?? FOOTER_LAYOUT.Focused));
  return LAYOUTS[((index + delta) % LAYOUTS.length + LAYOUTS.length) % LAYOUTS.length] ?? FOOTER_LAYOUT.Focused;
}
