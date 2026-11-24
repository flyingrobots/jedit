import type { PreviewHighlighter, SourceHighlightReading } from '../../ports/source-highlighter.js';
import { FilePreviewKinds, type FilePreviewResult } from '../../ports/file-preview.js';

const LINE_SEPARATOR = '\n';
const FIRST_LINE = 0;

const TAB_SPACES = '    ';
const UNSAFE_CONTROLS = /[\p{Cc}\p{Cf}]/gu;

export function filePreviewSourceLines(lines: readonly string[]): readonly string[] {
  return lines.map((line) => line.replaceAll('\t', TAB_SPACES).replace(UNSAFE_CONTROLS, ''));
}

export async function highlightFilePreview(
  path: string,
  result: FilePreviewResult,
  highlighter: PreviewHighlighter | undefined,
): Promise<SourceHighlightReading | undefined> {
  if (result.kind !== FilePreviewKinds.Loaded || highlighter == null) return undefined;
  const lines = filePreviewSourceLines(result.lines);
  try {
    const highlight = await highlighter.highlightPreview({ path, text: lines.join(LINE_SEPARATOR), startLine: FIRST_LINE, lineCount: lines.length });
    return highlight.path === path ? highlight : undefined;
  } catch { return undefined; }
}
