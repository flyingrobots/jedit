// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Unkeyed BLAKE3-256, written from the BLAKE3 specification (section 2) so the
// schema-2 fixtures never hash with the Echo or Jedit code they will judge.
// Reference vectors from the blake3 1.8.7 crate pin it in the fixture spec.

const IV = Object.freeze([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
const MESSAGE_PERMUTATION = Object.freeze([2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8]);
const BLOCK_LEN = 64;
const CHUNK_LEN = 1024;
const OUT_LEN = 32;
const ROUNDS = 7;
const CHUNK_START = 1;
const CHUNK_END = 2;
const PARENT = 4;
const ROOT = 8;

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function mix(state: number[], a: number, b: number, c: number, d: number, x: number, y: number): void {
  state[a] = (state[a]! + state[b]! + x) >>> 0;
  state[d] = rotr(state[d]! ^ state[a]!, 16);
  state[c] = (state[c]! + state[d]!) >>> 0;
  state[b] = rotr(state[b]! ^ state[c]!, 12);
  state[a] = (state[a]! + state[b]! + y) >>> 0;
  state[d] = rotr(state[d]! ^ state[a]!, 8);
  state[c] = (state[c]! + state[d]!) >>> 0;
  state[b] = rotr(state[b]! ^ state[c]!, 7);
}

function round(state: number[], m: readonly number[]): void {
  mix(state, 0, 4, 8, 12, m[0]!, m[1]!);
  mix(state, 1, 5, 9, 13, m[2]!, m[3]!);
  mix(state, 2, 6, 10, 14, m[4]!, m[5]!);
  mix(state, 3, 7, 11, 15, m[6]!, m[7]!);
  mix(state, 0, 5, 10, 15, m[8]!, m[9]!);
  mix(state, 1, 6, 11, 12, m[10]!, m[11]!);
  mix(state, 2, 7, 8, 13, m[12]!, m[13]!);
  mix(state, 3, 4, 9, 14, m[14]!, m[15]!);
}

function compress(cv: readonly number[], block: readonly number[], counter: number, blockLen: number,
  flags: number): number[] {
  const state = [...cv, IV[0]!, IV[1]!, IV[2]!, IV[3]!, counter >>> 0, Math.floor(counter / 0x100000000) >>> 0,
    blockLen, flags];
  let message = [...block];
  for (let index = 0; index < ROUNDS; index += 1) {
    round(state, message);
    message = MESSAGE_PERMUTATION.map((source) => message[source]!);
  }
  return state.slice(0, 8).map((word, index) => (word ^ state[index + 8]!) >>> 0);
}

function blockWords(bytes: Uint8Array, offset: number): number[] {
  const words: number[] = [];
  for (let word = 0; word < 16; word += 1) {
    let value = 0;
    for (let byte = 0; byte < 4; byte += 1) {
      value |= (bytes[offset + word * 4 + byte] ?? 0) << (8 * byte);
    }
    words.push(value >>> 0);
  }
  return words;
}

class Output {
  readonly cv: readonly number[];
  readonly block: readonly number[];
  readonly counter: number;
  readonly blockLen: number;
  readonly flags: number;

  constructor(cv: readonly number[], block: readonly number[], counter: number, blockLen: number, flags: number) {
    this.cv = cv;
    this.block = block;
    this.counter = counter;
    this.blockLen = blockLen;
    this.flags = flags;
  }

  chainingValue(): number[] {
    return compress(this.cv, this.block, this.counter, this.blockLen, this.flags);
  }

  rootBytes(): Uint8Array {
    const words = compress(this.cv, this.block, 0, this.blockLen, this.flags | ROOT);
    const out = new Uint8Array(OUT_LEN);
    words.forEach((word, index) => {
      for (let byte = 0; byte < 4; byte += 1) {
        out[index * 4 + byte] = (word >>> (8 * byte)) & 0xff;
      }
    });
    return out;
  }
}

function chunkOutput(bytes: Uint8Array, chunkIndex: number): Output {
  const start = chunkIndex * CHUNK_LEN;
  const end = Math.min(start + CHUNK_LEN, bytes.length);
  const blockCount = Math.max(1, Math.ceil((end - start) / BLOCK_LEN));
  let cv: readonly number[] = IV;
  for (let block = 0; block < blockCount - 1; block += 1) {
    const flags = block === 0 ? CHUNK_START : 0;
    cv = compress(cv, blockWords(bytes.subarray(0, end), start + block * BLOCK_LEN), chunkIndex, BLOCK_LEN, flags);
  }
  const lastOffset = start + (blockCount - 1) * BLOCK_LEN;
  const lastLen = end - lastOffset;
  const flags = (blockCount === 1 ? CHUNK_START : 0) | CHUNK_END;
  return new Output(cv, blockWords(bytes.subarray(0, end), lastOffset), chunkIndex, lastLen, flags);
}

function parentOutput(left: readonly number[], right: readonly number[]): Output {
  return new Output(IV, [...left, ...right], 0, BLOCK_LEN, PARENT);
}

// The tree is the left-heavy binary tree of section 2.1: the left subtree of
// any parent holds the largest power-of-two number of chunks that leaves at
// least one chunk on the right.
function subtreeOutput(bytes: Uint8Array, firstChunk: number, chunkCount: number): Output {
  if (chunkCount === 1) {
    return chunkOutput(bytes, firstChunk);
  }
  let leftCount = 1;
  while (leftCount * 2 < chunkCount) {
    leftCount *= 2;
  }
  const left = subtreeOutput(bytes, firstChunk, leftCount).chainingValue();
  const right = subtreeOutput(bytes, firstChunk + leftCount, chunkCount - leftCount).chainingValue();
  return parentOutput(left, right);
}

export function blake3(bytes: Uint8Array): Uint8Array {
  const chunkCount = Math.max(1, Math.ceil(bytes.length / CHUNK_LEN));
  return subtreeOutput(bytes, 0, chunkCount).rootBytes();
}
