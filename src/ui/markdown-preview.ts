import { clipToWidth, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { JEDIT_MARKDOWN_TOKEN, type JeditStyleToken, type JeditTheme } from './jedit-theme.js';

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
type PreviewSegmentTone = 'body' | 'heading-strong' | 'heading' | 'heading-soft' | 'list-marker' | 'quote-marker' | 'quote-text' | 'code' | 'inline-code' | 'rule';

export interface MarkdownPreviewSegment {
  readonly text: string;
  readonly tone: PreviewSegmentTone;
}

export interface MarkdownPreviewLine {
  readonly kind: PreviewLineKind;
  readonly segments: readonly MarkdownPreviewSegment[];
}

export type MarkdownPreviewTheme = JeditTheme;

export function previewMarkdownLines(text: string): readonly MarkdownPreviewLine[] {
  const lines: MarkdownPreviewLine[] = [];
  let inCodeFence = false;

  for (const rawLine of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if (FENCE_RE.test(rawLine)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      lines.push({
        kind: 'code',
        segments: [{ text: rawLine, tone: 'code' }],
      });
      continue;
    }

    const headingMatch = rawLine.match(HEADING_RE);
    if (headingMatch != null) {
      const headingMarks = headingMatch[1] ?? '#';
      const headingText = headingMatch[2] ?? '';
      lines.push({
        kind: headingKind(headingMarks.length),
        segments: inlineCodeSegments(headingText, headingTone(headingMarks.length)),
      });
      continue;
    }

    const unorderedListMatch = rawLine.match(UNORDERED_LIST_RE);
    if (unorderedListMatch != null) {
      const listText = unorderedListMatch[1] ?? '';
      lines.push({
        kind: 'list',
        segments: [
          { text: LIST_BULLET, tone: 'list-marker' },
          ...inlineCodeSegments(listText, 'body'),
        ],
      });
      continue;
    }

    const orderedListMatch = rawLine.match(ORDERED_LIST_RE);
    if (orderedListMatch != null) {
      const listIndex = orderedListMatch[1] ?? '1';
      const listText = orderedListMatch[2] ?? '';
      lines.push({
        kind: 'list',
        segments: [
          { text: `${listIndex}. `, tone: 'list-marker' },
          ...inlineCodeSegments(listText, 'body'),
        ],
      });
      continue;
    }

    const quoteMatch = rawLine.match(QUOTE_RE);
    if (quoteMatch != null) {
      const quoteText = quoteMatch[1] ?? '';
      lines.push({
        kind: 'quote',
        segments: [
          { text: QUOTE_BULLET, tone: 'quote-marker' },
          ...inlineCodeSegments(quoteText, 'quote-text'),
        ],
      });
      continue;
    }

    if (RULE_RE.test(rawLine)) {
      lines.push({
        kind: 'rule',
        segments: [{ text: RULE_TEXT, tone: 'rule' }],
      });
      continue;
    }

    if (rawLine.trim().length === 0) {
      lines.push({ kind: 'blank', segments: [] });
      continue;
    }

    lines.push({
      kind: 'body',
      segments: inlineCodeSegments(rawLine, 'body'),
    });
  }

  return lines;
}

export function paintMarkdownPreview(
  surface: Surface,
  text: string,
  scrollRow: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: MarkdownPreviewTheme,
) {
  const lines = previewMarkdownLines(text);
  for (let row = 0; row < height; row += 1) {
    const line = lines[scrollRow + row];
    if (line == null) {
      continue;
    }

    paintPreviewBackground(surface, line, x, y + row, width, theme);
    paintPreviewSegments(surface, line.segments, x, y + row, width, theme);
  }
}

function paintPreviewBackground(
  surface: Surface,
  line: MarkdownPreviewLine,
  x: number,
  y: number,
  width: number,
  theme: MarkdownPreviewTheme,
) {
  if (line.kind !== 'code') {
    return;
  }

  const token = codeLineToken(theme);
  for (let column = 0; column < width; column += 1) {
    const cell = surface.get(x + column, y);
    surface.set(x + column, y, {
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
  segments: readonly MarkdownPreviewSegment[],
  x: number,
  y: number,
  width: number,
  theme: MarkdownPreviewTheme,
) {
  let cursor = x;
  const end = x + width;

  for (const segment of segments) {
    if (cursor >= end) {
      return;
    }

    const clipped = clipToWidth(segment.text, end - cursor);
    if (clipped.length === 0) {
      continue;
    }

    const segmentSurface = stringToSurface(clipped, [...clipped].length, 1);
    applyToken(segmentSurface, tokenForTone(theme, segment.tone));
    surface.blit(segmentSurface, cursor, y);
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
  if (tone === 'heading-strong') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.HeadingStrong);
  }
  if (tone === 'heading') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.Heading);
  }
  if (tone === 'heading-soft') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.HeadingSoft);
  }
  if (tone === 'list-marker') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.ListMarker);
  }
  if (tone === 'quote-marker') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.QuoteMarker);
  }
  if (tone === 'quote-text') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.QuoteText);
  }
  if (tone === 'code') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.Code);
  }
  if (tone === 'inline-code') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.InlineCode);
  }
  if (tone === 'rule') {
    return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.Rule);
  }
  return markdownToken(theme, JEDIT_MARKDOWN_TOKEN.Body);
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
