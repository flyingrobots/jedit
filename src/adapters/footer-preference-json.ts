import { FOOTER_LAYOUT, type FooterLayout } from '../ui/footer-layout.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
interface ValueSpan { readonly start: number; readonly end: number }
const FOOTER_PROPERTY = 'footerLayout';
const EMPTY_DOCUMENT = '{}\n';

/** Validate JSON, then edit only this preference's raw span. */
export function footerPreferenceDocument(source: string = EMPTY_DOCUMENT) {
  const parsed: JsonValue = JSON.parse(source);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('Expected a JSON object');
  const spans = footerSpans(source);
  if (spans.length > 1) throw new SyntaxError('Duplicate footerLayout preferences');
  const span = spans[0];
  return {
    layout: decodeLayout(parsed[FOOTER_PROPERTY]),
    withLayout: (layout: FooterLayout) => replaceLayout(source, span, layout, Object.keys(parsed).length),
  };
}

function decodeLayout(value: JsonValue | undefined): FooterLayout {
  if (value === FOOTER_LAYOUT.Compact) return FOOTER_LAYOUT.Compact;
  return value === FOOTER_LAYOUT.PerPane ? FOOTER_LAYOUT.PerPane : FOOTER_LAYOUT.Focused;
}

function replaceLayout(source: string, span: ValueSpan | undefined, layout: FooterLayout, properties: number): string {
  const encoded = JSON.stringify(layout);
  if (span != null) return source.slice(0, span.start) + encoded + source.slice(span.end);
  const end = source.lastIndexOf('}');
  const separator = properties === 0 ? '' : ',';
  return `${source.slice(0, end)}${separator}\n  "${FOOTER_PROPERTY}": ${encoded}\n${source.slice(end)}`;
}

function footerSpans(source: string): ValueSpan[] {
  const spans: ValueSpan[] = [];
  let offset = source.indexOf('{') + 1;
  while (offset < source.length) {
    offset = skipSpace(source, offset);
    if (source[offset] === '}') break;
    const keyEnd = stringEnd(source, offset);
    const key: string = JSON.parse(source.slice(offset, keyEnd));
    const start = skipSpace(source, source.indexOf(':', keyEnd) + 1);
    const end = valueEnd(source, start);
    if (key === FOOTER_PROPERTY) spans.push({ start, end });
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
