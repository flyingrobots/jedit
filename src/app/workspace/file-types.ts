import { extname } from 'node:path';

const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  '.md',
  '.markdown',
] as const);

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extname(path).toLowerCase());
}
