export type I18nDirection = 'ltr' | 'rtl';

export interface I18nPort {
  readonly locale: string;
  readonly direction: I18nDirection;
  
  /**
   * Translate a key with optional interpolation values.
   * Path is dot-separated, e.g. "footer.mode.insert"
   */
  t(path: string, values?: Record<string, string | number>): string;
  
  /**
   * Set the current locale and direction.
   */
  setLocale(locale: string, direction: I18nDirection): void;
}
