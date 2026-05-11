export function isMarkdownFile(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.markdown');
}
