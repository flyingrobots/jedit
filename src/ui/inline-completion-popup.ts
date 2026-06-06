import {
  createSurface,
  stringToSurface,
  type Surface,
} from "@flyingrobots/bijou";
import type { JeditStyleToken, JeditTheme } from "./jedit-theme.js";
import { fitLine } from "./workspace-render.js";

export const INLINE_COMPLETION_ITEM_KIND = Object.freeze({
  Command: "command",
  File: "file",
  Directory: "directory",
  Symbol: "symbol",
  Documentation: "documentation",
  SourceDefinition: "source_definition",
  CausalHistory: "causal_history",
} as const);

export type InlineCompletionItemKind =
  (typeof INLINE_COMPLETION_ITEM_KIND)[keyof typeof INLINE_COMPLETION_ITEM_KIND];

export const INLINE_COMPLETION_PREVIEW_KIND = Object.freeze({
  File: "file",
  Documentation: "documentation",
  SourceDefinition: "source_definition",
  CausalHistory: "causal_history",
  Unavailable: "unavailable",
} as const);

export type InlineCompletionPreviewKind =
  (typeof INLINE_COMPLETION_PREVIEW_KIND)[keyof typeof INLINE_COMPLETION_PREVIEW_KIND];

export interface InlineCompletionReplacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface InlineCompletionItem {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly kind: InlineCompletionItemKind;
  readonly providerId: string;
  readonly replacement: InlineCompletionReplacement;
  readonly previewRequestId?: string;
}

export interface InlineCompletionPreview {
  readonly id: string;
  readonly kind: InlineCompletionPreviewKind;
  readonly title: string;
  readonly lines: readonly string[];
  readonly providerId: string;
  readonly evidencePosture?: string;
}

export interface RenderInlineCompletionPopupOptions {
  readonly items: readonly InlineCompletionItem[];
  readonly selectedIndex: number;
  readonly theme: JeditTheme;
  readonly width: number;
  readonly maxHeight: number;
}

const INLINE_COMPLETION_SELECTED_MARK = "›";
const INLINE_COMPLETION_UNSELECTED_MARK = " ";
const INLINE_COMPLETION_COLUMN_GAP = "  ";
const INLINE_COMPLETION_KIND_LABELS = {
  [INLINE_COMPLETION_ITEM_KIND.Command]: "C",
  [INLINE_COMPLETION_ITEM_KIND.File]: "F",
  [INLINE_COMPLETION_ITEM_KIND.Directory]: "D",
  [INLINE_COMPLETION_ITEM_KIND.Symbol]: "S",
  [INLINE_COMPLETION_ITEM_KIND.Documentation]: "?",
  [INLINE_COMPLETION_ITEM_KIND.SourceDefinition]: "→",
  [INLINE_COMPLETION_ITEM_KIND.CausalHistory]: "H",
} satisfies Record<InlineCompletionItemKind, string>;
const INLINE_COMPLETION_MIN_WIDTH = 1;
const INLINE_COMPLETION_MIN_HEIGHT = 0;
const INLINE_COMPLETION_FIRST_INDEX = 0;
const INLINE_COMPLETION_ITEM_STEP = 1;

interface InlineCompletionRow {
  readonly item: InlineCompletionItem;
  readonly selected: boolean;
}

export function renderInlineCompletionPopup(
  options: RenderInlineCompletionPopupOptions,
): Surface {
  const width = Math.max(INLINE_COMPLETION_MIN_WIDTH, options.width);
  const height = inlineCompletionSurfaceHeight(options);
  const surface = createSurface(width, height);
  fillSurface(surface, options.theme.surface.drawer);

  const firstItemIndex = firstVisibleCompletionIndex(options, height);
  for (let row = 0; row < height; row += INLINE_COMPLETION_ITEM_STEP) {
    const item = options.items[firstItemIndex + row];
    if (item != null) {
      paintCompletionRow(
        surface,
        {
          item,
          selected: firstItemIndex + row === selectedCompletionIndex(options),
        },
        row,
        options.theme,
      );
    }
  }

  return surface;
}

function inlineCompletionSurfaceHeight(
  options: Pick<RenderInlineCompletionPopupOptions, "items" | "maxHeight">,
): number {
  return Math.max(
    INLINE_COMPLETION_MIN_HEIGHT,
    Math.min(options.items.length, options.maxHeight),
  );
}

function firstVisibleCompletionIndex(
  options: Pick<RenderInlineCompletionPopupOptions, "items" | "selectedIndex">,
  height: number,
): number {
  const selected = selectedCompletionIndex(options);
  const overflow = selected - height + INLINE_COMPLETION_ITEM_STEP;
  return Math.max(
    INLINE_COMPLETION_FIRST_INDEX,
    Math.min(Math.max(0, options.items.length - height), overflow),
  );
}

function selectedCompletionIndex(
  options: Pick<RenderInlineCompletionPopupOptions, "items" | "selectedIndex">,
): number {
  return Math.max(
    INLINE_COMPLETION_FIRST_INDEX,
    Math.min(Math.max(0, options.items.length - 1), options.selectedIndex),
  );
}

function paintCompletionRow(
  surface: Surface,
  row: InlineCompletionRow,
  y: number,
  theme: JeditTheme,
): void {
  const token = row.selected ? theme.cursor.normal : theme.surface.drawer;
  paintText(surface, completionRowText(row), y, token);
}

function completionRowText(row: InlineCompletionRow): string {
  const mark = row.selected
    ? INLINE_COMPLETION_SELECTED_MARK
    : INLINE_COMPLETION_UNSELECTED_MARK;
  return `${mark} ${row.item.label}${INLINE_COMPLETION_COLUMN_GAP}${kindLabel(row.item.kind)}${INLINE_COMPLETION_COLUMN_GAP}${row.item.detail}`;
}

function kindLabel(kind: InlineCompletionItemKind): string {
  return INLINE_COMPLETION_KIND_LABELS[kind];
}

function paintText(
  surface: Surface,
  text: string,
  y: number,
  token: JeditStyleToken,
): void {
  const line = stringToSurface(fitLine(text, surface.width), surface.width, 1);
  applyToken(line, token);
  surface.blit(line, 0, y);
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: " ",
    fg: token.fg,
    fgRGB: token.fgRGB,
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyToken(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
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
