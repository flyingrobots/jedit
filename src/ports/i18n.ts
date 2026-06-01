export type I18nDirection = 'ltr' | 'rtl';

export interface I18nLocaleOption {
  readonly locale: string;
  readonly label: string;
  readonly direction: I18nDirection;
}

export interface I18nPort {
  readonly locale: string;
  readonly localeLabel: string;
  readonly direction: I18nDirection;
  readonly locales: readonly I18nLocaleOption[];

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
