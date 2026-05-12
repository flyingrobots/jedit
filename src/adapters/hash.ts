import { createHash } from 'node:crypto';
import type { HashPort } from '../ports/hash.js';

const UTF8_ENCODING = 'utf8';
const SHA256_ALGORITHM = 'sha256';
const HEX_DIGEST_ENCODING = 'hex';

export function createHashPort(): HashPort {
  return {
    sha256Hex(value) {
      return createHash(SHA256_ALGORITHM).update(value, UTF8_ENCODING).digest(HEX_DIGEST_ENCODING);
    },
  };
}
