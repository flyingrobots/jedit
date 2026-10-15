import type { PreviewHighlighter, SourceHighlightReading } from '../../ports/source-highlighter.js';
import { FilePreviewKinds, type FilePreviewResult } from '../../ports/file-preview.js';

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
    const highlight = await highlighter.highlightPreview({ path, text: lines.join('\n'), startLine: 0, lineCount: lines.length });
    return highlight.path === path ? highlight : undefined;
  } catch { return undefined; }
}
