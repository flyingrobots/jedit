import { catalogs, type Locale, type TranslationSchema } from '../generated/i18n.js';
import type { I18nDirection, I18nPort } from '../ports/i18n.js';

type TranslationNode = string | { [key: string]: TranslationNode };

const DEFAULT_LOCALE: Locale = 'en';
const DEFAULT_DIRECTION: I18nDirection = 'ltr';

export class BijouI18nAdapter implements I18nPort {
  private _locale: Locale;
  private _direction: I18nDirection;
  private _catalog: TranslationSchema;

  constructor(locale: Locale = DEFAULT_LOCALE, direction: I18nDirection = DEFAULT_DIRECTION) {
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
    const translation = resolveTranslation(this._catalog, path);
    return translation == null ? path : interpolateTranslation(translation, values);
  }

  setLocale(locale: string, direction: I18nDirection): void {
    this._locale = resolveLocale(locale);
    this._direction = direction;
    this._catalog = catalogs[this._locale];
  }
}

function isTranslationNode(value: string | Record<string, TranslationNode>): value is TranslationNode {
  if (typeof value === 'string') {
    return true;
  }
  return isTranslationObject(value) && Object.values(value).every(isTranslationNode);
}

function isTranslationRecord(value: string | Record<string, TranslationNode>): value is Record<string, TranslationNode> {
  return value != null && typeof value === 'object';
}

function isTranslationObject(value: string | Record<string, TranslationNode>): value is Record<string, TranslationNode> {
  return isTranslationRecord(value) && !Array.isArray(value);
}

function resolveTranslation(catalog: TranslationSchema, path: string): string | undefined {
  let current: Record<string, TranslationNode> | string = catalog;
  for (const key of path.split('.')) {
    const next = translationChild(current, key);
    if (next == null) {
      return undefined;
    }
    current = next;
  }
  return typeof current === 'string' ? current : undefined;
}

function translationChild(current: Record<string, TranslationNode> | string, key: string): TranslationNode | undefined {
  if (!isTranslationRecord(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
    return undefined;
  }
  const next = current[key];
  return next == null || !isTranslationNode(next) ? undefined : next;
}

function interpolateTranslation(template: string, values: Record<string, string | number> | undefined): string {
  let result = template;
  for (const [key, value] of Object.entries(values ?? {})) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

function resolveLocale(value: string): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function isLocale(value: string): value is Locale {
  return Object.prototype.hasOwnProperty.call(catalogs, value);
}
