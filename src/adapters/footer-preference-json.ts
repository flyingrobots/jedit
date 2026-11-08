import { FILEPATH_STYLE, type FilepathStyle } from '../ports/filepath-style.js';
import { FOOTER_LAYOUT, type FooterLayout } from '../ports/footer-preferences.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
interface ValueSpan { readonly start: number; readonly end: number }
const FOOTER_PROPERTY = 'footerLayout';
const FILEPATH_PROPERTY = 'filepathStyle';
const EMPTY_DOCUMENT = '{}\n';

/** Validate JSON, then edit only this preference's raw span. */
export function footerPreferenceDocument(source: string = EMPTY_DOCUMENT) {
  const parsed: JsonValue = JSON.parse(source);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('Expected a JSON object');
  const layoutSpan = preferenceSpan(source, FOOTER_PROPERTY);
  const filepathSpan = preferenceSpan(source, FILEPATH_PROPERTY);
  const properties = Object.keys(parsed).length;
  return {
    layout: decodeLayout(parsed[FOOTER_PROPERTY]),
    filepathStyle: parsed[FILEPATH_PROPERTY] === FILEPATH_STYLE.Absolute ? FILEPATH_STYLE.Absolute : FILEPATH_STYLE.GitRoot,
    withLayout: (value: FooterLayout) => replacePreference(source, { span: layoutSpan, property: FOOTER_PROPERTY, value, properties }),
    withFilepaths: (value: FilepathStyle) => replacePreference(source, { span: filepathSpan, property: FILEPATH_PROPERTY, value, properties }),
  };
}

function decodeLayout(value: JsonValue | undefined): FooterLayout {
  if (value === FOOTER_LAYOUT.Compact) return FOOTER_LAYOUT.Compact;
  return value === FOOTER_LAYOUT.PerPane ? FOOTER_LAYOUT.PerPane : FOOTER_LAYOUT.Focused;
}

interface PreferenceReplacement {
  readonly span?: ValueSpan; readonly property: string; readonly value: string; readonly properties: number;
}
function replacePreference(source: string, replacement: PreferenceReplacement): string {
  const { span, property, value, properties } = replacement;
  const encoded = JSON.stringify(value);
  if (span != null) return source.slice(0, span.start) + encoded + source.slice(span.end);
  const end = source.lastIndexOf('}');
  const separator = properties === 0 ? '' : ',';
  return `${source.slice(0, end)}${separator}\n  "${property}": ${encoded}\n${source.slice(end)}`;
}

function footerSpans(source: string, property: string): ValueSpan[] {
  const spans: ValueSpan[] = [];
  let offset = source.indexOf('{') + 1;
  while (offset < source.length) {
    offset = skipSpace(source, offset);
    if (source[offset] === '}') break;
    const keyEnd = stringEnd(source, offset);
    const key: string = JSON.parse(source.slice(offset, keyEnd));
    const start = skipSpace(source, source.indexOf(':', keyEnd) + 1);
    const end = valueEnd(source, start);
    if (key === property) spans.push({ start, end });
    offset = skipSpace(source, end);
    if (source[offset] !== ',') break;
    offset += 1;
  }
  return spans;
}

function skipSpace(source: string, offset: number): number {
  while (/\s/.test(source.charAt(offset)) && offset < source.length) offset += 1;
  return offset;
}

function stringEnd(source: string, start: number): number {
  let offset = start + 1;
  while (offset < source.length) {
    if (source[offset] === '\\') offset += 2;
    else if (source[offset] === '"') return offset + 1;
    else offset += 1;
  }
  throw new SyntaxError('Unterminated JSON string');
}

function valueEnd(source: string, start: number): number {
  let depth = 0;
  let offset = start;
  while (offset < source.length) {
    const char = source.charAt(offset);
    if (char === '"') { offset = stringEnd(source, offset); continue; }
    if (depth === 0 && /[,}]/.test(char)) break;
    if (/[{\[]/.test(char)) depth += 1;
    if (/[}\]]/.test(char)) depth -= 1;
    offset += 1;
  }
  return trimValueEnd(source, start, offset);
}

function trimValueEnd(source: string, start: number, end: number): number {
  while (end > start && /\s/.test(source.charAt(end - 1))) end -= 1;
  return end;
}

function preferenceSpan(source: string, property: string): ValueSpan | undefined {
  const spans = footerSpans(source, property);
  if (spans.length > 1) throw new SyntaxError(`Duplicate ${property} preferences`);
  return spans[0];
}
