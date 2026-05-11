import { createHash } from 'node:crypto';
import type { HashPort } from '../ports/hash.js';

const UTF8_ENCODING = 'utf8';

export function createHashPort(): HashPort {
  return {
    sha256Hex(value) {
      return createHash('sha256').update(value, UTF8_ENCODING).digest('hex');
    },
  };
}
