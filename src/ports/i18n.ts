export const I18N_TEXT_DIRECTION = Object.freeze({
  Ltr: 'ltr',
  Rtl: 'rtl',
} as const);

export type I18nDirection = (typeof I18N_TEXT_DIRECTION)[keyof typeof I18N_TEXT_DIRECTION];

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
   * Set the current locale. Direction follows locale metadata.
   */
  setLocale(locale: string): void;

  /**
   * Return an equivalent i18n port using the requested locale.
   */
  withLocale(locale: string): I18nPort;
}
