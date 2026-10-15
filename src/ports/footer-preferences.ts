import type { FilepathStyle } from './filepath-style.js';
export const FOOTER_LAYOUT = Object.freeze({
  Focused: 'focused', PerPane: 'per-pane', Compact: 'compact',
} as const);
export type FooterLayout = typeof FOOTER_LAYOUT[keyof typeof FOOTER_LAYOUT];

export type FooterPreferenceSave = { readonly ok: true } | { readonly ok: false };

/** Application preferences live outside authoritative text and its causal history. */
export interface FooterPreferencesPort {
  loadFilepaths(): FilepathStyle;
  saveFilepaths(style: FilepathStyle): FooterPreferenceSave;
  load(): FooterLayout;
  save(layout: FooterLayout): FooterPreferenceSave;
}
