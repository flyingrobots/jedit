import { readFileSync, statSync, writeFileSync } from 'node:fs';
import {
  directoryEditorFile,
  missingEditorFile,
  obstructedEditorFile,
  type EditorFileLoadResult,
  type EditorFilePort,
} from '../ports/editor-file.js';
import { editorFileFingerprintFromBytes } from '../ports/editor-file-fingerprint.js';
import { joinLines, normalizeLines } from '../app/editor-lines.js';

const NULL_BYTE = 0;
const UTF8_ENCODING = 'utf8';
const BINARY_FILE_MESSAGE = '[binary file]';
const NODE_ERROR_NOT_FOUND = 'ENOENT';
const NON_FILE_MESSAGE = 'path is not a regular file';

export function loadEditorFile(filePath: string): EditorFileLoadResult {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return directoryEditorFile(filePath);
    }
    if (!stat.isFile()) {
      return obstructedEditorFile(filePath, NON_FILE_MESSAGE);
    }
    const bytes = readFileSync(filePath);
    const fingerprint = editorFileFingerprintFromBytes(bytes);
    if (bytes.includes(NULL_BYTE)) {
      return {
        lines: [BINARY_FILE_MESSAGE],
        readOnly: true,
        fingerprint,
      };
    }

    return {
      lines: normalizeLines(bytes.toString(UTF8_ENCODING)),
      readOnly: false,
      fingerprint,
    };
  } catch (cause) {
    const code = cause instanceof Error ? nodeErrorCode(cause) : undefined;
    return code === NODE_ERROR_NOT_FOUND
      ? missingEditorFile(filePath)
      : obstructedEditorFile(filePath, cause instanceof Error ? cause.message : String(cause), code);
  }
}

export function saveEditorFile(filePath: string, lines: readonly string[]): void {
  writeFileSync(filePath, joinLines(lines), UTF8_ENCODING);
}

export const editorFilePort: EditorFilePort = {
  loadEditorFile,
  saveEditorFile,
};

function nodeErrorCode(cause: Error): string | undefined {
  return 'code' in cause && typeof cause.code === 'string'
    ? cause.code
    : undefined;
}
