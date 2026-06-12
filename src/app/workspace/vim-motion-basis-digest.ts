const FIRST_INDEX = 0;
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const HASH_PAD_TEXT = '0';
const HASH_RADIX = 16;
const HASH_TEXT_WIDTH = 8;
const LINE_BREAK_TEXT = '\n';
const BASIS_DIGEST_PREFIX = 'vim-basis';

export function vimMotionBasisDigest(lines: readonly string[]): string {
  const text = lines.join(LINE_BREAK_TEXT);
  return `${BASIS_DIGEST_PREFIX}:${lines.length}:${text.length}:${fnv1a32Hex(text)}`;
}

function fnv1a32Hex(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = FIRST_INDEX; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME);
  }
  return (hash >>> FIRST_INDEX).toString(HASH_RADIX).padStart(HASH_TEXT_WIDTH, HASH_PAD_TEXT);
}
