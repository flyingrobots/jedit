// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The declared reconstruction profile: fromBytes, prefix/suffix by path copy,
// and AVL concatenation (join without a middle key). Existing nodes are reused
// by id; a stored branch is expanded, and so validated, only when descended.
import { countLineBreaks } from './rope-reader.mts';
import type { RopeReader, StoredNode } from './rope-reader.mts';
import { MAX_LEAF_BYTES } from './schema-2-facts.mts';

export class NewLeaf {
  readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    if (bytes.length === 0 || bytes.length > MAX_LEAF_BYTES) throw new RangeError('a leaf holds 1-4096 bytes');
    this.bytes = bytes;
  }
}

export class NewBranch {
  readonly left: Rope;
  readonly right: Rope;
  readonly byteLength: bigint;
  readonly lineBreaks: bigint;
  readonly height: bigint;
  constructor(left: Rope, right: Rope) {
    this.left = left;
    this.right = right;
    this.byteLength = byteLength(left) + byteLength(right);
    this.lineBreaks = lineBreaks(left) + lineBreaks(right);
    this.height = 1n + (height(left) > height(right) ? height(left) : height(right));
  }
}

export type Rope = StoredNode | NewLeaf | NewBranch;

export function byteLength(rope: Rope): bigint {
  return rope instanceof NewLeaf ? BigInt(rope.bytes.length) : rope.byteLength;
}

export function lineBreaks(rope: Rope): bigint {
  return rope instanceof NewLeaf ? countLineBreaks(rope.bytes) : rope.lineBreaks;
}

export function height(rope: Rope): bigint {
  return rope instanceof NewLeaf ? 1n : rope.height;
}

/** A position is a character boundary unless the byte there continues a UTF-8 sequence. */
export function isCharBoundary(bytes: Uint8Array, offset: number): boolean {
  if (offset === 0 || offset === bytes.length) return true;
  if (offset > bytes.length) return false;
  const byte = bytes[offset]!;
  return byte < 0x80 || byte > 0xbf;
}

export function fromBytes(bytes: Uint8Array): Rope | null {
  if (bytes.length === 0) return null;
  if (bytes.length <= MAX_LEAF_BYTES) return new NewLeaf(bytes);
  let middle = Math.floor(bytes.length / 2);
  while (!isCharBoundary(bytes, middle)) middle -= 1;
  return new NewBranch(fromBytes(bytes.subarray(0, middle))!, fromBytes(bytes.subarray(middle))!);
}

export class RopeBuilder {
  readonly reader: RopeReader;
  constructor(reader: RopeReader) {
    this.reader = reader;
  }

  children(rope: Rope): readonly [Rope, Rope] {
    if (rope instanceof NewBranch) return [rope.left, rope.right];
    if (rope instanceof NewLeaf || rope.isLeaf) throw new RangeError('a leaf has no children');
    return this.reader.expand(rope);
  }

  isLeaf(rope: Rope): boolean {
    return rope instanceof NewLeaf || (!(rope instanceof NewBranch) && rope.isLeaf);
  }

  leafBytes(rope: Rope): Uint8Array {
    return rope instanceof NewLeaf ? rope.bytes : (rope instanceof NewBranch ? new Uint8Array() : rope.bytes);
  }

  prefix(rope: Rope, offset: bigint): Rope | null {
    if (offset === 0n) return null;
    if (offset === byteLength(rope)) return rope;
    if (this.isLeaf(rope)) return new NewLeaf(this.leafBytes(rope).subarray(0, Number(offset)));
    const [left, right] = this.children(rope);
    if (offset <= byteLength(left)) return this.prefix(left, offset);
    return this.join(left, this.prefix(right, offset - byteLength(left)));
  }

  suffix(rope: Rope, offset: bigint): Rope | null {
    if (offset === 0n) return rope;
    if (offset === byteLength(rope)) return null;
    if (this.isLeaf(rope)) return new NewLeaf(this.leafBytes(rope).subarray(Number(offset)));
    const [left, right] = this.children(rope);
    if (offset < byteLength(left)) return this.join(this.suffix(left, offset), right);
    return this.suffix(right, offset - byteLength(left));
  }

  join(left: Rope | null, right: Rope | null): Rope | null {
    if (left === null) return right;
    if (right === null) return left;
    const skew = height(left) - height(right);
    if (skew > 1n) return this.joinRight(left, right);
    if (skew < -1n) return this.joinLeft(left, right);
    return new NewBranch(left, right);
  }

  joinRight(tall: Rope, short: Rope): Rope {
    const [left, inner] = this.children(tall);
    if (height(inner) <= height(short) + 1n) {
      const joined = new NewBranch(inner, short);
      if (height(joined) <= height(left) + 1n) return new NewBranch(left, joined);
      return this.rotateLeft(new NewBranch(left, this.rotateRight(joined)));
    }
    const joined = this.joinRight(inner, short);
    const result = new NewBranch(left, joined);
    return height(joined) <= height(left) + 1n ? result : this.rotateLeft(result);
  }

  joinLeft(short: Rope, tall: Rope): Rope {
    const [inner, right] = this.children(tall);
    if (height(inner) <= height(short) + 1n) {
      const joined = new NewBranch(short, inner);
      if (height(joined) <= height(right) + 1n) return new NewBranch(joined, right);
      return this.rotateRight(new NewBranch(this.rotateLeft(joined), right));
    }
    const joined = this.joinLeft(short, inner);
    const result = new NewBranch(joined, right);
    return height(joined) <= height(right) + 1n ? result : this.rotateRight(result);
  }

  rotateLeft(rope: Rope): Rope {
    const [left, right] = this.children(rope);
    const [middle, outer] = this.children(right);
    return new NewBranch(new NewBranch(left, middle), outer);
  }

  rotateRight(rope: Rope): Rope {
    const [left, right] = this.children(rope);
    const [outer, middle] = this.children(left);
    return new NewBranch(outer, new NewBranch(middle, right));
  }
}
