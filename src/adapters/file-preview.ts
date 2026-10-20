import { constants, closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { normalizeLines } from '../app/editor-lines.js';
import { FilePreviewKinds, FILE_PREVIEW_MAX_BYTES, FILE_PREVIEW_MAX_LINES, type FilePreviewSource } from '../ports/file-preview.js';

const UTF8_ENCODING = 'utf-8';
const NULL_BYTE = 0;

export const filePreviewSource: FilePreviewSource = {
  loadFilePreview(path) {
    let descriptor: number | undefined;
    try {
      descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
      const stat = fstatSync(descriptor);
      if (!stat.isFile()) return { kind: FilePreviewKinds.Unavailable };
      const bytes = Buffer.alloc(FILE_PREVIEW_MAX_BYTES);
      const read = readSync(descriptor, bytes, 0, bytes.length, 0);
      const content = bytes.subarray(0, read);
      if (content.includes(NULL_BYTE)) return { kind: FilePreviewKinds.Binary };
      const lines = normalizeLines(new TextDecoder(UTF8_ENCODING).decode(content, { stream: read < stat.size }));
      return {
        kind: FilePreviewKinds.Loaded, lines: lines.slice(0, FILE_PREVIEW_MAX_LINES),
        truncated: read < stat.size || lines.length > FILE_PREVIEW_MAX_LINES,
      };
    } catch {
      return { kind: FilePreviewKinds.Unavailable };
    } finally {
      if (descriptor != null) closeSync(descriptor);
    }
  },
};
