import {
  INLINE_COMPLETION_ITEM_KIND,
  INLINE_COMPLETION_PREVIEW_KIND,
  type InlineCompletionItem,
  type InlineCompletionPreview,
} from "../../ui/inline-completion-popup.js";
import type { GraftInfo } from "../../ports/graft-session.js";
import type {
  WorkspaceEditorCompletionContext,
  WorkspaceEditorCompletionProvider,
} from "./editor-completion.js";

export const WORKSPACE_GRAFT_SYMBOL_PROVIDER_ID = "graft-symbol";

export interface WorkspaceGraftSymbolCompletionProviderOptions {
  readonly graftInfo?: GraftInfo;
  readonly maxItems?: number;
}

export interface WorkspaceGraftSymbolUnavailablePreviewOptions {
  readonly reason?: string;
  readonly evidencePosture?: string;
}

const GRAFT_SYMBOL_FIRST_INDEX = 0;
const GRAFT_SYMBOL_DEFAULT_MAX_ITEMS = 20;
const GRAFT_SYMBOL_EMPTY_PREFIX = "";
const GRAFT_SYMBOL_UNAVAILABLE_PREVIEW_ID = "preview:graft-symbol:unavailable";
const GRAFT_SYMBOL_UNAVAILABLE_PREVIEW_TITLE = "Graft symbols";
const GRAFT_SYMBOL_UNAVAILABLE_REASON = "Graft adapter unavailable";
const GRAFT_SYMBOL_UNAVAILABLE_POSTURE = "unavailable";

export function workspaceGraftSymbolCompletionProvider(
  options: WorkspaceGraftSymbolCompletionProviderOptions,
): WorkspaceEditorCompletionProvider {
  return {
    id: WORKSPACE_GRAFT_SYMBOL_PROVIDER_ID,
    complete: (context) => workspaceGraftSymbolCompletionItems(context, options),
  };
}

export function workspaceGraftSymbolCompletionItems(
  context: WorkspaceEditorCompletionContext,
  options: WorkspaceGraftSymbolCompletionProviderOptions,
): readonly InlineCompletionItem[] {
  const graftInfo = options.graftInfo;
  if (graftInfo == null || graftInfo.path !== context.filePath) {
    return [];
  }

  return graftInfo.outlineItems
    .filter((item) => symbolMatchesPrefix(item.name, context.prefix))
    .slice(GRAFT_SYMBOL_FIRST_INDEX, maxSymbolItems(options.maxItems))
    .map((item) => ({
      id: graftSymbolCompletionId(graftInfo, item),
      label: item.name,
      detail: graftSymbolCompletionDetail(graftInfo, item),
      kind: INLINE_COMPLETION_ITEM_KIND.Symbol,
      providerId: WORKSPACE_GRAFT_SYMBOL_PROVIDER_ID,
      previewRequestId: graftSymbolCompletionPreviewRequestId(graftInfo, item),
      replacement: {
        start: context.wordStartCol,
        end: context.wordEndCol,
        text: item.name,
      },
    }));
}

export function workspaceGraftSymbolUnavailablePreview(
  options: WorkspaceGraftSymbolUnavailablePreviewOptions = {},
): InlineCompletionPreview {
  return {
    id: GRAFT_SYMBOL_UNAVAILABLE_PREVIEW_ID,
    kind: INLINE_COMPLETION_PREVIEW_KIND.Unavailable,
    title: GRAFT_SYMBOL_UNAVAILABLE_PREVIEW_TITLE,
    lines: [options.reason ?? GRAFT_SYMBOL_UNAVAILABLE_REASON],
    providerId: WORKSPACE_GRAFT_SYMBOL_PROVIDER_ID,
    evidencePosture:
      options.evidencePosture ?? GRAFT_SYMBOL_UNAVAILABLE_POSTURE,
  };
}

function symbolMatchesPrefix(symbolName: string, prefix: string): boolean {
  const normalizedPrefix = prefix.toLowerCase();
  return (
    normalizedPrefix === GRAFT_SYMBOL_EMPTY_PREFIX ||
    symbolName.toLowerCase().startsWith(normalizedPrefix)
  );
}

function maxSymbolItems(maxItems: number | undefined): number {
  return Math.max(
    GRAFT_SYMBOL_FIRST_INDEX,
    Math.floor(maxItems ?? GRAFT_SYMBOL_DEFAULT_MAX_ITEMS),
  );
}

function graftSymbolCompletionId(
  graftInfo: GraftInfo,
  item: GraftInfo["outlineItems"][number],
): string {
  return [
    WORKSPACE_GRAFT_SYMBOL_PROVIDER_ID,
    graftInfo.relativePath,
    item.name,
    item.startLine,
    item.endLine,
  ].join(":");
}

function graftSymbolCompletionPreviewRequestId(
  graftInfo: GraftInfo,
  item: GraftInfo["outlineItems"][number],
): string {
  return `preview:${graftSymbolCompletionId(graftInfo, item)}`;
}

function graftSymbolCompletionDetail(
  graftInfo: GraftInfo,
  item: GraftInfo["outlineItems"][number],
): string {
  return `${item.kind} ${graftInfo.relativePath}:${item.startLine}`;
}
