import { catalogs, type Locale, type TranslationSchema } from '../generated/i18n.js';
import type { I18nDirection, I18nPort } from '../ports/i18n.js';

export class BijouI18nAdapter implements I18nPort {
  private _locale: Locale;
  private _direction: I18nDirection;
  private _catalog: TranslationSchema;

  constructor(locale: Locale = 'en', direction: I18nDirection = 'ltr') {
    this._locale = locale;
    this._direction = direction;
    this._catalog = catalogs[locale];
  }

  get locale(): string {
    return this._locale;
  }

  get direction(): I18nDirection {
    return this._direction;
  }

  t(path: string, values?: Record<string, string | number>): string {
    const keys = path.split('.');
    let current: object | string = this._catalog;
    
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return path;
      }
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        current = (current as Record<string, object | string>)[key] as object | string;
      } else {
        return path;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    let result = current;
    if (values) {
      for (const [key, value] of Object.entries(values)) {
        result = result.replace(`{${key}}`, String(value));
      }
    }

    return result;
  }

  setLocale(locale: string, direction: I18nDirection): void {
    this._locale = locale as Locale;
    this._direction = direction;
    this._catalog = catalogs[this._locale] || catalogs['en'];
  }
}
