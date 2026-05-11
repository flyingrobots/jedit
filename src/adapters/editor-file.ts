import { readFileSync, writeFileSync } from 'node:fs';
import type { EditorFilePort, LoadedEditorFile } from '../ports/editor-file.js';
import { joinLines, normalizeLines } from '../app/editor-lines.js';

const NULL_BYTE = 0;
const UTF8_ENCODING = 'utf8';
const BINARY_FILE_MESSAGE = '[binary file]';

export function loadEditorFile(filePath: string): LoadedEditorFile {
  const bytes = readFileSync(filePath);
  if (bytes.includes(NULL_BYTE)) {
    return {
      lines: [BINARY_FILE_MESSAGE],
      readOnly: true,
    };
  }

  return {
    lines: normalizeLines(bytes.toString(UTF8_ENCODING)),
    readOnly: false,
  };
}

export function saveEditorFile(filePath: string, lines: readonly string[]): void {
  writeFileSync(filePath, joinLines(lines), UTF8_ENCODING);
}

export const editorFilePort: EditorFilePort = {
  loadEditorFile,
  saveEditorFile,
};
