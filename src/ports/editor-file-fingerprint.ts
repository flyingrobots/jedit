import { createHash } from 'node:crypto';
import {
  EditorFileFingerprintAlgorithms,
  type EditorFileFingerprint,
} from './editor-file.js';

const UTF8_ENCODING = 'utf8';

export function editorFileFingerprintFromBytes(
  bytes: Uint8Array,
): EditorFileFingerprint {
  const hash = createHash(EditorFileFingerprintAlgorithms.Sha256);
  hash.update(bytes);
  return {
    algorithm: EditorFileFingerprintAlgorithms.Sha256,
    digest: hash.digest('hex'),
    byteLength: bytes.byteLength,
  };
}

export function editorFileFingerprintFromText(
  text: string,
): EditorFileFingerprint {
  return editorFileFingerprintFromBytes(Buffer.from(text, UTF8_ENCODING));
}

export function editorFileFingerprintsEqual(
  left: EditorFileFingerprint,
  right: EditorFileFingerprint,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.digest === right.digest &&
    left.byteLength === right.byteLength
  );
}
