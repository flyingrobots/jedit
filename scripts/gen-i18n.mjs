import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mock/Simplified generation logic based on the identified pattern
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'translations.json');
const OUT_DIR = join(ROOT, 'src', 'generated');
const OUT_FILE = join(OUT_DIR, 'i18n.ts');

const translations = JSON.parse(readFileSync(SOURCE, 'utf8'));

function generateTypes(obj, indent = '') {
  let code = '{\n';
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object') {
      code += `${indent}  readonly ${key}: ${generateTypes(value, indent + '  ')};\n`;
    } else {
      code += `${indent}  readonly ${key}: string;\n`;
    }
  }
  code += `${indent}}`;
  return code;
}

function generateData(obj, indent = '') {
  let code = '{\n';
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object') {
      code += `${indent}  ${key}: ${generateData(value, indent + '  ')},\n`;
    } else {
      code += `${indent}  ${key}: '${value}',\n`;
    }
  }
  code += `${indent}}`;
  return code;
}

function mirror(text) {
  return [...text].reverse().join('');
}

function generateMirrorData(obj, indent = '') {
  let code = '{\n';
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object') {
      code += `${indent}  ${key}: ${generateMirrorData(value, indent + '  ')},\n`;
    } else {
      code += `${indent}  ${key}: '${mirror(value)}',\n`;
    }
  }
  code += `${indent}}`;
  return code;
}

const typeDef = `export type TranslationSchema = ${generateTypes(translations)};`;

const tsContent = `
${typeDef}

export const en: TranslationSchema = ${generateData(translations)};

export const me: TranslationSchema = ${generateMirrorData(translations)};

export type Locale = 'en' | 'me';

export const catalogs: Record<Locale, TranslationSchema> = {
  en,
  me
};
`;

writeFileSync(OUT_FILE, tsContent);
console.log('Generated src/generated/i18n.ts');
