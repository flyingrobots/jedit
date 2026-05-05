const LINE_FEED = '\n';

export function normalizeLines(text: string): readonly string[] {
  const lines = text.replace(/\r\n/g, LINE_FEED).replace(/\r/g, LINE_FEED).split(LINE_FEED);
  return lines.length === 0 ? [''] : lines;
}

export function joinLines(lines: readonly string[]): string {
  return lines.join(LINE_FEED);
}
