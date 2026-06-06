import type {
  InlineCompletionItem,
  InlineCompletionPreview,
} from "./inline-completion-popup.js";

export const INLINE_COMPLETION_POPUP_PLACEMENT = Object.freeze({
  Above: "above",
  Below: "below",
} as const);

export type InlineCompletionPopupPlacement =
  (typeof INLINE_COMPLETION_POPUP_PLACEMENT)[keyof typeof INLINE_COMPLETION_POPUP_PLACEMENT];

export interface InlineCompletionPopupAnchor {
  readonly x: number;
  readonly y: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export interface ResolveInlineCompletionPopupGeometryOptions {
  readonly items: readonly InlineCompletionItem[];
  readonly width: number;
  readonly maxHeight: number;
  readonly preview?: InlineCompletionPreview;
  readonly anchor?: InlineCompletionPopupAnchor;
}

export interface InlineCompletionPopupGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly placement: InlineCompletionPopupPlacement;
  readonly listWidth: number;
  readonly previewWidth: number;
  readonly previewVisible: boolean;
  readonly visibleItemCount: number;
}

interface InlineCompletionPopupLayout {
  readonly listWidth: number;
  readonly previewWidth: number;
  readonly previewVisible: boolean;
}

export const INLINE_COMPLETION_PREVIEW_RULE_WIDTH = 1;

const INLINE_COMPLETION_MIN_WIDTH = 1;
const INLINE_COMPLETION_MIN_HEIGHT = 0;
const INLINE_COMPLETION_ITEM_STEP = 1;
const INLINE_COMPLETION_PREVIEW_WIDTH_RATIO = 0.42;
const INLINE_COMPLETION_PREVIEW_MIN_WIDTH = 24;
const INLINE_COMPLETION_PREVIEW_MAX_WIDTH = 48;
const INLINE_COMPLETION_LIST_MIN_WIDTH_WITH_PREVIEW = 24;
const INLINE_COMPLETION_PREVIEW_HEADER_ROWS = 1;
const INLINE_COMPLETION_PREVIEW_FALLBACK_BODY_ROWS = 1;

export function resolveInlineCompletionPopupGeometry(
  options: ResolveInlineCompletionPopupGeometryOptions,
): InlineCompletionPopupGeometry {
  const width = resolvedInlineCompletionPopupWidth(options);
  const layout = inlineCompletionPopupLayout(width, options.preview);
  const requestedHeight = inlineCompletionRequestedHeight(options, layout);
  const placement = inlineCompletionPlacement(options.anchor, requestedHeight);
  const availableHeight = inlineCompletionAvailableHeight(options.anchor, placement);
  const height = options.anchor == null
    ? requestedHeight
    : Math.min(requestedHeight, availableHeight);

  return {
    x: inlineCompletionPopupX(options.anchor, width),
    y: inlineCompletionPopupY(options.anchor, height, placement),
    width,
    height,
    placement,
    listWidth: layout.listWidth,
    previewWidth: layout.previewWidth,
    previewVisible: layout.previewVisible,
    visibleItemCount: Math.min(options.items.length, height),
  };
}

function inlineCompletionRequestedHeight(
  options: ResolveInlineCompletionPopupGeometryOptions,
  layout: InlineCompletionPopupLayout,
): number {
  const listHeight = inlineCompletionListHeight(options);
  const previewHeight =
    layout.previewVisible && options.preview != null
      ? previewRowCount(options.preview)
      : INLINE_COMPLETION_MIN_HEIGHT;
  return Math.max(
    INLINE_COMPLETION_MIN_HEIGHT,
    Math.min(Math.max(listHeight, previewHeight), nonNegativeInteger(options.maxHeight)),
  );
}

function inlineCompletionListHeight(
  options: Pick<ResolveInlineCompletionPopupGeometryOptions, "items" | "maxHeight">,
): number {
  return Math.min(options.items.length, nonNegativeInteger(options.maxHeight));
}

function previewRowCount(preview: InlineCompletionPreview): number {
  const evidenceRows =
    preview.evidencePosture == null || preview.evidencePosture.length === 0
      ? 0
      : 1;
  return (
    INLINE_COMPLETION_PREVIEW_HEADER_ROWS +
    evidenceRows +
    Math.max(INLINE_COMPLETION_PREVIEW_FALLBACK_BODY_ROWS, preview.lines.length)
  );
}

function inlineCompletionPopupLayout(
  width: number,
  preview: InlineCompletionPreview | undefined,
): InlineCompletionPopupLayout {
  const previewWidth = resolvedInlineCompletionPreviewWidth(width, preview);
  const previewVisible = previewWidth > 0;
  return {
    listWidth: previewVisible
      ? width - INLINE_COMPLETION_PREVIEW_RULE_WIDTH - previewWidth
      : width,
    previewWidth,
    previewVisible,
  };
}

function resolvedInlineCompletionPreviewWidth(
  width: number,
  preview: InlineCompletionPreview | undefined,
): number {
  if (preview == null) {
    return 0;
  }

  const desiredPreviewWidth = Math.min(
    INLINE_COMPLETION_PREVIEW_MAX_WIDTH,
    Math.max(
      INLINE_COMPLETION_PREVIEW_MIN_WIDTH,
      Math.floor(width * INLINE_COMPLETION_PREVIEW_WIDTH_RATIO),
    ),
  );
  const listWidth =
    width - INLINE_COMPLETION_PREVIEW_RULE_WIDTH - desiredPreviewWidth;
  return listWidth < INLINE_COMPLETION_LIST_MIN_WIDTH_WITH_PREVIEW
    ? 0
    : desiredPreviewWidth;
}

function resolvedInlineCompletionPopupWidth(
  options: Pick<ResolveInlineCompletionPopupGeometryOptions, "width" | "anchor">,
): number {
  const requested = positiveInteger(options.width, INLINE_COMPLETION_MIN_WIDTH);
  const screenWidth = options.anchor == null
    ? requested
    : positiveInteger(options.anchor.screenWidth, INLINE_COMPLETION_MIN_WIDTH);
  return Math.max(INLINE_COMPLETION_MIN_WIDTH, Math.min(requested, screenWidth));
}

function inlineCompletionPlacement(
  anchor: InlineCompletionPopupAnchor | undefined,
  height: number,
): InlineCompletionPopupPlacement {
  if (anchor == null) {
    return INLINE_COMPLETION_POPUP_PLACEMENT.Below;
  }

  const below = rowsBelowAnchor(anchor);
  const above = rowsAboveAnchor(anchor);
  return below >= height || below >= above
    ? INLINE_COMPLETION_POPUP_PLACEMENT.Below
    : INLINE_COMPLETION_POPUP_PLACEMENT.Above;
}

function inlineCompletionAvailableHeight(
  anchor: InlineCompletionPopupAnchor | undefined,
  placement: InlineCompletionPopupPlacement,
): number {
  if (anchor == null) {
    return Number.MAX_SAFE_INTEGER;
  }
  return placement === INLINE_COMPLETION_POPUP_PLACEMENT.Below
    ? rowsBelowAnchor(anchor)
    : rowsAboveAnchor(anchor);
}

function inlineCompletionPopupX(
  anchor: InlineCompletionPopupAnchor | undefined,
  width: number,
): number {
  if (anchor == null) {
    return 0;
  }

  const screenWidth = nonNegativeInteger(anchor.screenWidth);
  const maxX = Math.max(0, screenWidth - width);
  return Math.max(0, Math.min(nonNegativeInteger(anchor.x), maxX));
}

function inlineCompletionPopupY(
  anchor: InlineCompletionPopupAnchor | undefined,
  height: number,
  placement: InlineCompletionPopupPlacement,
): number {
  if (anchor == null) {
    return 0;
  }

  const anchorY = nonNegativeInteger(anchor.y);
  return placement === INLINE_COMPLETION_POPUP_PLACEMENT.Below
    ? anchorY + INLINE_COMPLETION_ITEM_STEP
    : Math.max(0, anchorY - height);
}

function rowsBelowAnchor(anchor: InlineCompletionPopupAnchor): number {
  return Math.max(
    0,
    nonNegativeInteger(anchor.screenHeight) -
      nonNegativeInteger(anchor.y) -
      INLINE_COMPLETION_ITEM_STEP,
  );
}

function rowsAboveAnchor(anchor: InlineCompletionPopupAnchor): number {
  return Math.max(0, nonNegativeInteger(anchor.y));
}

function positiveInteger(value: number, minimum: number): number {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.floor(value))
    : minimum;
}

function nonNegativeInteger(value: number): number {
  return positiveInteger(value, 0);
}
