import {
  createSurface,
  stringToSurface,
  type Surface,
} from "@flyingrobots/bijou";
import {
  INLINE_COMPLETION_PREVIEW_RULE_WIDTH,
  resolveInlineCompletionPopupGeometry,
} from "./inline-completion-popup-geometry.js";
import type {
  InlineCompletionPopupAnchor,
  InlineCompletionPopupGeometry,
} from "./inline-completion-popup-geometry.js";
import type { JeditStyleToken, JeditTheme } from "./jedit-theme.js";
import { fitLine } from "./workspace-render.js";

export {
  INLINE_COMPLETION_POPUP_PLACEMENT,
  resolveInlineCompletionPopupGeometry,
} from "./inline-completion-popup-geometry.js";
export type {
  InlineCompletionPopupAnchor,
  InlineCompletionPopupGeometry,
  InlineCompletionPopupPlacement,
  ResolveInlineCompletionPopupGeometryOptions,
} from "./inline-completion-popup-geometry.js";

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
  readonly preview?: InlineCompletionPreview;
  readonly anchor?: InlineCompletionPopupAnchor;
}

const INLINE_COMPLETION_SELECTED_MARK = "›";
const INLINE_COMPLETION_UNSELECTED_MARK = " ";
const INLINE_COMPLETION_COLUMN_GAP = "  ";
const INLINE_COMPLETION_PREVIEW_RULE = "│";
const INLINE_COMPLETION_PREVIEW_EVIDENCE_PREFIX = "Evidence:";
const INLINE_COMPLETION_NO_PREVIEW_TEXT = "No preview";
const INLINE_COMPLETION_KIND_LABELS = {
  [INLINE_COMPLETION_ITEM_KIND.Command]: "cmd",
  [INLINE_COMPLETION_ITEM_KIND.File]: "file",
  [INLINE_COMPLETION_ITEM_KIND.Directory]: "dir",
  [INLINE_COMPLETION_ITEM_KIND.Symbol]: "sym",
  [INLINE_COMPLETION_ITEM_KIND.Documentation]: "docs",
  [INLINE_COMPLETION_ITEM_KIND.SourceDefinition]: "src",
  [INLINE_COMPLETION_ITEM_KIND.CausalHistory]: "hist",
} satisfies Record<InlineCompletionItemKind, string>;
const INLINE_COMPLETION_PREVIEW_KIND_LABELS = {
  [INLINE_COMPLETION_PREVIEW_KIND.File]: "FILE",
  [INLINE_COMPLETION_PREVIEW_KIND.Documentation]: "DOCS",
  [INLINE_COMPLETION_PREVIEW_KIND.SourceDefinition]: "SRC",
  [INLINE_COMPLETION_PREVIEW_KIND.CausalHistory]: "HIST",
  [INLINE_COMPLETION_PREVIEW_KIND.Unavailable]: "NONE",
} satisfies Record<InlineCompletionPreviewKind, string>;
const INLINE_COMPLETION_FIRST_INDEX = 0;
const INLINE_COMPLETION_ITEM_STEP = 1;

interface InlineCompletionRow {
  readonly item: InlineCompletionItem;
  readonly selected: boolean;
}

interface InlineCompletionTextBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export function renderInlineCompletionPopup(
  options: RenderInlineCompletionPopupOptions,
): Surface {
  const geometry = resolveInlineCompletionPopupGeometry(options);
  const surface = createSurface(geometry.width, geometry.height);
  fillSurface(surface, options.theme.surface.drawer);

  const firstItemIndex = firstVisibleCompletionIndex(
    options,
    geometry.visibleItemCount,
  );
  for (let row = 0; row < geometry.height; row += INLINE_COMPLETION_ITEM_STEP) {
    const item = options.items[firstItemIndex + row];
    if (item != null) {
      paintCompletionRow(
        surface,
        {
          item,
          selected: firstItemIndex + row === selectedCompletionIndex(options),
        },
        row,
        geometry.listWidth,
        options.theme,
      );
    }
  }

  if (geometry.previewVisible && options.preview != null) {
    paintInlineCompletionPreview(surface, geometry, options.preview, options.theme);
  }

  return surface;
}

function firstVisibleCompletionIndex(
  options: Pick<RenderInlineCompletionPopupOptions, "items" | "selectedIndex">,
  height: number,
): number {
  if (height <= 0) {
    return INLINE_COMPLETION_FIRST_INDEX;
  }
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
  width: number,
  theme: JeditTheme,
): void {
  const token = row.selected ? theme.cursor.normal : theme.surface.drawer;
  paintText(surface, completionRowText(row), { x: 0, y, width }, token);
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

function paintInlineCompletionPreview(
  surface: Surface,
  geometry: InlineCompletionPopupGeometry,
  preview: InlineCompletionPreview,
  theme: JeditTheme,
): void {
  const ruleX = geometry.listWidth;
  const previewX = ruleX + INLINE_COMPLETION_PREVIEW_RULE_WIDTH;
  paintVerticalRule(surface, ruleX, theme.surface.drawer);
  const rows = previewRows(preview);
  for (let y = 0; y < surface.height; y += 1) {
    paintText(
      surface,
      rows[y] ?? "",
      { x: previewX, y, width: geometry.previewWidth },
      theme.surface.drawer,
    );
  }
}

function paintVerticalRule(
  surface: Surface,
  x: number,
  token: JeditStyleToken,
): void {
  for (let y = 0; y < surface.height; y += 1) {
    const cell = surface.get(x, y);
    surface.set(x, y, {
      ...cell,
      char: INLINE_COMPLETION_PREVIEW_RULE,
      fg: token.fg,
      fgRGB: token.fgRGB,
      bg: token.bg,
      bgRGB: token.bgRGB,
      modifiers: token.modifiers == null ? undefined : [...token.modifiers],
      empty: false,
    });
  }
}

function previewRows(preview: InlineCompletionPreview): readonly string[] {
  const rows = [
    `${previewKindLabel(preview.kind)} ${preview.title}`.trim(),
  ];
  if (preview.evidencePosture != null && preview.evidencePosture.length > 0) {
    rows.push(
      `${INLINE_COMPLETION_PREVIEW_EVIDENCE_PREFIX} ${preview.evidencePosture}`,
    );
  }

  rows.push(
    ...(preview.lines.length === 0
      ? [INLINE_COMPLETION_NO_PREVIEW_TEXT]
      : preview.lines),
  );
  return rows;
}

function previewKindLabel(kind: InlineCompletionPreviewKind): string {
  return INLINE_COMPLETION_PREVIEW_KIND_LABELS[kind];
}

function paintText(
  surface: Surface,
  text: string,
  bounds: InlineCompletionTextBounds,
  token: JeditStyleToken,
): void {
  if (bounds.width <= 0 || bounds.y < 0 || bounds.y >= surface.height) {
    return;
  }
  const line = stringToSurface(fitLine(text, bounds.width), bounds.width, 1);
  applyToken(line, token);
  surface.blit(line, bounds.x, bounds.y);
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
