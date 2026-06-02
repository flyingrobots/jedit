import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'translations.json');
const OUT_DIR = join(ROOT, 'src', 'generated');
const OUT_FILE = join(OUT_DIR, 'i18n.ts');
const DEFAULT_LOCALE = 'en';
const DIRECTION_LTR = 'ltr';
const DIRECTION_RTL = 'rtl';
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const PLACEHOLDER_SPLIT_PATTERN = /(\{[A-Za-z_][A-Za-z0-9_]*\})/g;
const PLACEHOLDER_EXACT_PATTERN = /^\{[A-Za-z_][A-Za-z0-9_]*\}$/;

const source = JSON.parse(readFileSync(SOURCE, 'utf8'));
const root = readRecord(source, 'translations root');
const localeSources = readRecord(root.locales, 'translations.locales');
const mirrorLocaleSource = readRecord(root.mirrorLocale, 'translations.mirrorLocale');
const authoredLocales = Object.entries(localeSources).map(([id, value]) => readAuthoredLocale(id, value));
const defaultLocale = authoredLocales.find((locale) => locale.id === DEFAULT_LOCALE);

if (defaultLocale == null) {
  throw new Error(`translations.locales must include ${DEFAULT_LOCALE}`);
}

for (const locale of authoredLocales) {
  assertSameShape(defaultLocale.messages, locale.messages, locale.id);
}

const mirrorLocale = readMirrorLocale(mirrorLocaleSource, defaultLocale);
const locales = [...authoredLocales, mirrorLocale];
const typeDef = `export type TranslationSchema = ${generateTypes(defaultLocale.messages)};`;
const localeConstants = locales.map(generateLocaleConstant).join('\n');
const localeIds = locales.map((locale) => JSON.stringify(locale.id)).join(', ');
const metadataEntries = locales.map(generateMetadataEntry).join('\n');
const catalogEntries = locales.map(generateCatalogEntry).join('\n');

const tsContent = `${typeDef}

export type LocaleDirection = '${DIRECTION_LTR}' | '${DIRECTION_RTL}';

export interface LocaleMetadata {
  readonly label: string;
  readonly direction: LocaleDirection;
}

${localeConstants}
export const locales = [${localeIds}] as const;

export type Locale = typeof locales[number];

export const localeMetadata: Record<Locale, LocaleMetadata> = {
${metadataEntries}
};

export const catalogs: Record<Locale, TranslationSchema> = {
${catalogEntries}
};
`;

writeFileSync(OUT_FILE, tsContent);
console.log('Generated src/generated/i18n.ts');

function readAuthoredLocale(id, value) {
  const locale = readRecord(value, `translations.locales.${id}`);
  return {
    id,
    label: readString(locale.label, `${id}.label`),
    direction: readDirection(locale.direction, `${id}.direction`),
    messages: readMessages(locale.messages, `${id}.messages`),
  };
}

function readMirrorLocale(value, sourceLocale) {
  const sourceId = readString(value.source, 'mirrorLocale.source');
  if (sourceId !== sourceLocale.id) {
    throw new Error(`mirrorLocale.source must be ${sourceLocale.id}`);
  }
  return {
    id: readString(value.id, 'mirrorLocale.id'),
    label: readString(value.label, 'mirrorLocale.label'),
    direction: readDirection(value.direction, 'mirrorLocale.direction'),
    messages: mirrorMessages(sourceLocale.messages),
  };
}

function readMessages(value, label) {
  const messages = readRecord(value, label);
  assertMessageNode(messages, label);
  return messages;
}

function readRecord(value, label) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function readString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readDirection(value, label) {
  if (value !== DIRECTION_LTR && value !== DIRECTION_RTL) {
    throw new Error(`${label} must be ${DIRECTION_LTR} or ${DIRECTION_RTL}`);
  }
  return value;
}

function assertMessageNode(value, label) {
  if (typeof value === 'string') {
    return;
  }
  const record = readRecord(value, label);
  for (const [key, child] of Object.entries(record)) {
    assertMessageNode(child, `${label}.${key}`);
  }
}

function assertSameShape(expected, actual, localeId, path = '') {
  if (typeof expected === 'string' || typeof actual === 'string') {
    if (typeof expected !== typeof actual) {
      throw new Error(`${localeId} has mismatched message leaf at ${path}`);
    }
    return;
  }

  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(readRecord(actual, `${localeId}.${path}`));
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) {
      throw new Error(`${localeId} is missing message key ${joinPath(path, key)}`);
    }
    assertSameShape(expected[key], actual[key], localeId, joinPath(path, key));
  }
  for (const key of actualKeys) {
    if (!Object.prototype.hasOwnProperty.call(expected, key)) {
      throw new Error(`${localeId} has extra message key ${joinPath(path, key)}`);
    }
  }
}

function joinPath(parent, key) {
  return parent.length === 0 ? key : `${parent}.${key}`;
}

function generateTypes(obj, indent = '') {
  let code = '{\n';
  for (const [key, value] of Object.entries(obj)) {
    const property = JSON.stringify(key);
    code += typeof value === 'object'
      ? `${indent}  readonly ${property}: ${generateTypes(value, `${indent}  `)};\n`
      : `${indent}  readonly ${property}: string;\n`;
  }
  code += `${indent}}`;
  return code;
}

function generateLocaleConstant(locale) {
  return `export const ${localeExportName(locale.id)}: TranslationSchema = ${JSON.stringify(locale.messages)};\n`;
}

function generateMetadataEntry(locale) {
  return `  ${propertyKey(locale.id)}: { label: ${JSON.stringify(locale.label)}, direction: ${JSON.stringify(locale.direction)} },`;
}

function generateCatalogEntry(locale) {
  return `  ${propertyKey(locale.id)}: ${localeExportName(locale.id)},`;
}

function localeExportName(localeId) {
  const name = localeId.replace(/-([A-Za-z0-9])/g, (_match, char) => char.toUpperCase());
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(`${localeId} cannot be exported as a TypeScript identifier`);
  }
  return name;
}

function propertyKey(key) {
  return IDENTIFIER_PATTERN.test(key) ? key : JSON.stringify(key);
}

function mirrorMessages(value) {
  if (typeof value === 'string') {
    return mirrorText(value);
  }
  const mirrored = {};
  for (const [key, child] of Object.entries(value)) {
    mirrored[key] = mirrorMessages(child);
  }
  return mirrored;
}

function mirrorText(value) {
  return value
    .split(PLACEHOLDER_SPLIT_PATTERN)
    .reverse()
    .map(mirrorTextPart)
    .join('');
}

function mirrorTextPart(value) {
  return PLACEHOLDER_EXACT_PATTERN.test(value) ? value : [...value].reverse().join('');
}
