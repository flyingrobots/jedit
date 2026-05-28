import { clipToWidth, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { JEDIT_MARKDOWN_TOKEN, type JeditMarkdownToken, type JeditStyleToken, type JeditTheme } from './jedit-theme.js';

const FENCE_RE = /^\s*```/;
const HEADING_RE = /^\s*(#{1,6})\s+(.*)$/;
const UNORDERED_LIST_RE = /^\s*[-*]\s+(.*)$/;
const ORDERED_LIST_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const RULE_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const INLINE_CODE_RE = /`([^`]+)`/g;
const LIST_BULLET = '• ';
const QUOTE_BULLET = '│ ';
const RULE_TEXT = '────────────────────────────────────────────────────────────────';

type PreviewLineKind = 'blank' | 'body' | 'heading-strong' | 'heading' | 'heading-soft' | 'list' | 'quote' | 'code' | 'rule';
type PreviewSegmentTone =
  | 'body'
  | 'heading-strong'
  | 'heading'
  | 'heading-soft'
  | 'list-marker'
  | 'quote-marker'
  | 'quote-text'
  | 'code'
  | 'inline-code'
  | 'rule';

const MARKDOWN_TOKEN_BY_TONE = new Map<PreviewSegmentTone, JeditMarkdownToken>([
  ['heading-strong', JEDIT_MARKDOWN_TOKEN.HeadingStrong],
  ['heading', JEDIT_MARKDOWN_TOKEN.Heading],
  ['heading-soft', JEDIT_MARKDOWN_TOKEN.HeadingSoft],
  ['list-marker', JEDIT_MARKDOWN_TOKEN.ListMarker],
  ['quote-marker', JEDIT_MARKDOWN_TOKEN.QuoteMarker],
  ['quote-text', JEDIT_MARKDOWN_TOKEN.QuoteText],
  ['code', JEDIT_MARKDOWN_TOKEN.Code],
  ['inline-code', JEDIT_MARKDOWN_TOKEN.InlineCode],
  ['rule', JEDIT_MARKDOWN_TOKEN.Rule],
]);

export interface MarkdownPreviewSegment {
  readonly text: string;
  readonly tone: PreviewSegmentTone;
}

export interface MarkdownPreviewLine {
  readonly kind: PreviewLineKind;
  readonly segments: readonly MarkdownPreviewSegment[];
}

export type MarkdownPreviewTheme = JeditTheme;

export interface PaintMarkdownPreviewOptions {
  readonly text: string;
  readonly scrollRow: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly theme: MarkdownPreviewTheme;
}

interface PaintPreviewBackgroundOptions {
  readonly line: MarkdownPreviewLine;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly theme: MarkdownPreviewTheme;
}

interface PaintPreviewSegmentsOptions {
  readonly segments: readonly MarkdownPreviewSegment[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly theme: MarkdownPreviewTheme;
}

interface PreviewMarkdownLineOptions {
  readonly inCodeFence: boolean;
}

export function previewMarkdownLines(text: string): readonly MarkdownPreviewLine[] {
  const lines: MarkdownPreviewLine[] = [];
  let inCodeFence = false;

  for (const rawLine of normalizedMarkdownLines(text)) {
    if (FENCE_RE.test(rawLine)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    lines.push(previewMarkdownLine(rawLine, { inCodeFence }));
  }

  return lines;
}

function normalizedMarkdownLines(text: string): readonly string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function previewMarkdownLine(rawLine: string, options: PreviewMarkdownLineOptions): MarkdownPreviewLine {
  if (options.inCodeFence) {
    return { kind: 'code', segments: [{ text: rawLine, tone: 'code' }] };
  }

  const parsed = headingPreviewLine(rawLine)
    ?? unorderedListPreviewLine(rawLine)
    ?? orderedListPreviewLine(rawLine)
    ?? quotePreviewLine(rawLine)
    ?? rulePreviewLine(rawLine)
    ?? blankPreviewLine(rawLine);
  return parsed ?? {
    kind: 'body',
    segments: inlineCodeSegments(rawLine, 'body'),
  };
}

function headingPreviewLine(rawLine: string): MarkdownPreviewLine | undefined {
  const headingMatch = rawLine.match(HEADING_RE);
  if (headingMatch == null) {
    return undefined;
  }
  const headingMarks = headingMatch[1] ?? '#';
  const headingText = headingMatch[2] ?? '';
  return {
    kind: headingKind(headingMarks.length),
    segments: inlineCodeSegments(headingText, headingTone(headingMarks.length)),
  };
}

function unorderedListPreviewLine(rawLine: string): MarkdownPreviewLine | undefined {
  const unorderedListMatch = rawLine.match(UNORDERED_LIST_RE);
  return unorderedListMatch == null
    ? undefined
    : listPreviewLine(LIST_BULLET, unorderedListMatch[1] ?? '');
}

function orderedListPreviewLine(rawLine: string): MarkdownPreviewLine | undefined {
  const orderedListMatch = rawLine.match(ORDERED_LIST_RE);
  return orderedListMatch == null
    ? undefined
    : listPreviewLine(`${orderedListMatch[1] ?? '1'}. `, orderedListMatch[2] ?? '');
}

function listPreviewLine(marker: string, text: string): MarkdownPreviewLine {
  return {
    kind: 'list',
    segments: [
      { text: marker, tone: 'list-marker' },
      ...inlineCodeSegments(text, 'body'),
    ],
  };
}

function quotePreviewLine(rawLine: string): MarkdownPreviewLine | undefined {
  const quoteMatch = rawLine.match(QUOTE_RE);
  if (quoteMatch == null) {
    return undefined;
  }
  return {
    kind: 'quote',
    segments: [
      { text: QUOTE_BULLET, tone: 'quote-marker' },
      ...inlineCodeSegments(quoteMatch[1] ?? '', 'quote-text'),
    ],
  };
}

function rulePreviewLine(rawLine: string): MarkdownPreviewLine | undefined {
  return RULE_RE.test(rawLine)
    ? { kind: 'rule', segments: [{ text: RULE_TEXT, tone: 'rule' }] }
    : undefined;
}

function blankPreviewLine(rawLine: string): MarkdownPreviewLine | undefined {
  return rawLine.trim().length === 0 ? { kind: 'blank', segments: [] } : undefined;
}

export function paintMarkdownPreview(
  surface: Surface,
  options: PaintMarkdownPreviewOptions,
) {
  const lines = previewMarkdownLines(options.text);
  for (let row = 0; row < options.height; row += 1) {
    const line = lines[options.scrollRow + row];
    if (line == null) {
      continue;
    }

    paintPreviewBackground(surface, {
      line,
      x: options.x,
      y: options.y + row,
      width: options.width,
      theme: options.theme,
    });
    paintPreviewSegments(surface, {
      segments: line.segments,
      x: options.x,
      y: options.y + row,
      width: options.width,
      theme: options.theme,
    });
  }
}

function paintPreviewBackground(
  surface: Surface,
  options: PaintPreviewBackgroundOptions,
) {
  if (options.line.kind !== 'code') {
    return;
  }

  const token = codeLineToken(options.theme);
  for (let column = 0; column < options.width; column += 1) {
    const cell = surface.get(options.x + column, options.y);
    surface.set(options.x + column, options.y, {
      ...cell,
      char: cell.char.length > 0 ? cell.char : ' ',
      bg: token.bg,
      bgRGB: token.bgRGB,
      empty: false,
    });
  }
}

function paintPreviewSegments(
  surface: Surface,
  options: PaintPreviewSegmentsOptions,
) {
  let cursor = options.x;
  const end = options.x + options.width;

  for (const segment of options.segments) {
    if (cursor >= end) {
      return;
    }

    const clipped = clipToWidth(segment.text, end - cursor);
    if (clipped.length === 0) {
      continue;
    }

    const segmentSurface = stringToSurface(clipped, [...clipped].length, 1);
    applyToken(segmentSurface, tokenForTone(options.theme, segment.tone));
    surface.blit(segmentSurface, cursor, options.y);
    cursor += [...clipped].length;
  }
}

function applyToken(surface: Surface, token: JeditStyleToken) {
  for (let row = 0; row < surface.height; row += 1) {
    for (let column = 0; column < surface.width; column += 1) {
      const cell = surface.get(column, row);
      if (cell.empty) {
        continue;
      }
      surface.set(column, row, {
        ...cell,
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        modifiers: token.modifiers == null ? undefined : [...token.modifiers],
        empty: false,
      });
    }
  }
}

function tokenForTone(theme: MarkdownPreviewTheme, tone: PreviewSegmentTone): JeditStyleToken {
  return markdownToken(theme, MARKDOWN_TOKEN_BY_TONE.get(tone) ?? JEDIT_MARKDOWN_TOKEN.Body);
}

function codeLineToken(theme: MarkdownPreviewTheme): JeditStyleToken {
  return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.Code);
}

function markdownToken(theme: MarkdownPreviewTheme, token: typeof JEDIT_MARKDOWN_TOKEN[keyof typeof JEDIT_MARKDOWN_TOKEN]): JeditStyleToken {
  return theme.markdown.get(token) ?? theme.surface.workspace;
}

function headingKind(depth: number): PreviewLineKind {
  if (depth <= 1) {
    return 'heading-strong';
  }
  if (depth === 2) {
    return 'heading';
  }
  return 'heading-soft';
}

function headingTone(depth: number): PreviewSegmentTone {
  if (depth <= 1) {
    return 'heading-strong';
  }
  if (depth === 2) {
    return 'heading';
  }
  return 'heading-soft';
}

function inlineCodeSegments(text: string, baseTone: PreviewSegmentTone): readonly MarkdownPreviewSegment[] {
  const segments: MarkdownPreviewSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_CODE_RE)) {
    const fullMatch = match[0];
    const codeText = match[1];
    const matchIndex = match.index ?? -1;
    if (matchIndex < 0 || codeText == null) {
      continue;
    }

    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), tone: baseTone });
    }

    segments.push({ text: codeText, tone: 'inline-code' });
    cursor = matchIndex + fullMatch.length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), tone: baseTone });
  }

  if (segments.length === 0) {
    return [{ text, tone: baseTone }];
  }

  return segments;
}
