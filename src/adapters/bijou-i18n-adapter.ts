import {
  catalogs,
  localeMetadata,
  locales as generatedLocales,
  type Locale,
  type TranslationSchema,
} from '../generated/i18n.js';
import type { I18nDirection, I18nLocaleOption, I18nPort } from '../ports/i18n.js';

type TranslationNode = string | { [key: string]: TranslationNode };

const DEFAULT_LOCALE: Locale = 'en';
const LOCALE_OPTIONS: readonly I18nLocaleOption[] = generatedLocales.map((locale) => ({
  locale,
  label: localeMetadata[locale].label,
  direction: localeMetadata[locale].direction,
}));

export class BijouI18nAdapter implements I18nPort {
  private _locale: Locale;
  private _direction: I18nDirection;
  private _catalog: TranslationSchema;

  constructor(locale: string = DEFAULT_LOCALE) {
    const resolved = resolveLocale(locale);
    this._locale = resolved;
    this._direction = localeMetadata[resolved].direction;
    this._catalog = catalogs[resolved];
  }

  get locale(): string {
    return this._locale;
  }

  get localeLabel(): string {
    return localeMetadata[this._locale].label;
  }

  get direction(): I18nDirection {
    return this._direction;
  }

  get locales(): readonly I18nLocaleOption[] {
    return LOCALE_OPTIONS;
  }

  t(path: string, values?: Record<string, string | number>): string {
    const translation = resolveTranslation(this._catalog, path);
    return translation == null ? path : interpolateTranslation(translation, values);
  }

  setLocale(locale: string): void {
    this._locale = resolveLocale(locale);
    this._direction = localeMetadata[this._locale].direction;
    this._catalog = catalogs[this._locale];
  }

  withLocale(locale: string): I18nPort {
    return new BijouI18nAdapter(locale);
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
  return Object.prototype.hasOwnProperty.call(catalogs, value)
    && Object.prototype.hasOwnProperty.call(localeMetadata, value);
}
