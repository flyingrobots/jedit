import { catalogs, type Locale, type TranslationSchema } from '../generated/i18n.js';
import type { I18nDirection, I18nPort } from '../ports/i18n.js';

type TranslationNode = string | { [key: string]: TranslationNode };

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
    let current: Record<string, TranslationNode> | string = this._catalog;

    for (const key of keys) {
      if (!isTranslationRecord(current)) {
        return path;
      }
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        const next: TranslationNode | undefined = current[key];
        if (next == null || !isTranslationNode(next)) {
          return path;
        }
        current = next;
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
    this._locale = resolveLocale(locale);
    this._direction = direction;
    this._catalog = catalogs[this._locale];
  }
}

function isTranslationNode(value: unknown): value is TranslationNode {
  if (typeof value === 'string') {
    return true;
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    const child = Object.getOwnPropertyDescriptor(value, key)?.value;
    if (!isTranslationNode(child)) {
      return false;
    }
  }
  return true;
}

function isTranslationRecord(value: unknown): value is Record<string, TranslationNode> {
  return value != null && typeof value === 'object';
}

function resolveLocale(value: string): Locale {
  return isLocale(value) ? value : 'en';
}

function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'me';
}
