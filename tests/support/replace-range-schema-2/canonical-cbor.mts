// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The subset of edict.canonical-cbor/v1 that schema-2 atoms use: unsigned
// integers, byte strings, text strings and maps with text keys. Written from
// the profile (shortest-width big-endian heads, maps sorted by encoded key
// bytes, no duplicates, re-encode check on decode), not from its Rust code.

const MAJOR_UNSIGNED = 0;
const MAJOR_BYTES = 2;
const MAJOR_TEXT = 3;
const MAJOR_MAP = 5;
const ONE_BYTE = 24;
const TWO_BYTES = 25;
const FOUR_BYTES = 26;
const EIGHT_BYTES = 27;
const U64_MAX = 0xffff_ffff_ffff_ffffn;

export class CborUint {
  readonly value: bigint;
  constructor(value: bigint) {
    if (value < 0n || value > U64_MAX) throw new RangeError(`unsigned integer out of range: ${value}`);
    this.value = value;
  }
}

export class CborBytes {
  readonly value: Uint8Array;
  constructor(value: Uint8Array) {
    this.value = value;
  }
}

export class CborText {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export class CborMap {
  readonly entries: ReadonlyMap<string, CborValue>;
  constructor(entries: ReadonlyMap<string, CborValue>) {
    this.entries = entries;
  }
}

export type CborValue = CborUint | CborBytes | CborText | CborMap;

export class CborDecodeError extends Error {}

function head(major: number, argument: bigint): Uint8Array {
  const prefix = major << 5;
  if (argument < 24n) return Uint8Array.of(prefix | Number(argument));
  const widths: ReadonlyArray<[bigint, number, number]> = [
    [0xffn, ONE_BYTE, 1], [0xffffn, TWO_BYTES, 2], [0xffff_ffffn, FOUR_BYTES, 4], [U64_MAX, EIGHT_BYTES, 8],
  ];
  const [, info, size] = widths.find(([limit]) => argument <= limit) ?? widths[3]!;
  const out = new Uint8Array(1 + size);
  out[0] = prefix | info;
  for (let index = 0; index < size; index += 1) {
    out[size - index] = Number((argument >> BigInt(8 * index)) & 0xffn);
  }
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return left.length - right.length;
}

export function encodeCbor(value: CborValue): Uint8Array {
  if (value instanceof CborUint) return head(MAJOR_UNSIGNED, value.value);
  if (value instanceof CborBytes) return concat([head(MAJOR_BYTES, BigInt(value.value.length)), value.value]);
  if (value instanceof CborText) {
    const bytes = new TextEncoder().encode(value.value);
    return concat([head(MAJOR_TEXT, BigInt(bytes.length)), bytes]);
  }
  const pairs = [...value.entries].map(([key, entry]) => [encodeCbor(new CborText(key)), encodeCbor(entry)] as const);
  pairs.sort(([left], [right]) => compareBytes(left, right));
  return concat([head(MAJOR_MAP, BigInt(pairs.length)), ...pairs.flat()]);
}

class Reader {
  readonly bytes: Uint8Array;
  offset = 0;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  take(count: number): Uint8Array {
    if (this.offset + count > this.bytes.length) throw new CborDecodeError('unexpected end of input');
    const out = this.bytes.subarray(this.offset, this.offset + count);
    this.offset += count;
    return out;
  }

  head(): [number, bigint] {
    const initial = this.take(1)[0]!;
    const info = initial & 0x1f;
    if (info < ONE_BYTE) return [initial >> 5, BigInt(info)];
    const size = { [ONE_BYTE]: 1, [TWO_BYTES]: 2, [FOUR_BYTES]: 4, [EIGHT_BYTES]: 8 }[info];
    if (size === undefined) throw new CborDecodeError(`unsupported additional information ${info}`);
    let argument = 0n;
    for (const byte of this.take(size)) argument = (argument << 8n) | BigInt(byte);
    return [initial >> 5, argument];
  }
}

function decodeValue(reader: Reader): CborValue {
  const [major, argument] = reader.head();
  if (major === MAJOR_UNSIGNED) return new CborUint(argument);
  if (major === MAJOR_BYTES) return new CborBytes(reader.take(Number(argument)).slice());
  if (major === MAJOR_TEXT) {
    const bytes = reader.take(Number(argument));
    try {
      return new CborText(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
    } catch {
      throw new CborDecodeError('text string is not UTF-8');
    }
  }
  if (major !== MAJOR_MAP) throw new CborDecodeError(`unsupported major type ${major}`);
  const entries = new Map<string, CborValue>();
  for (let index = 0n; index < argument; index += 1n) {
    const key = decodeValue(reader);
    if (!(key instanceof CborText)) throw new CborDecodeError('map key is not text');
    if (entries.has(key.value)) throw new CborDecodeError(`duplicate map key ${key.value}`);
    entries.set(key.value, decodeValue(reader));
  }
  return new CborMap(entries);
}

export function decodeCanonicalCbor(bytes: Uint8Array): CborValue {
  const reader = new Reader(bytes);
  const value = decodeValue(reader);
  if (reader.offset !== bytes.length) throw new CborDecodeError('trailing bytes after the value');
  if (compareBytes(encodeCbor(value), bytes) !== 0) throw new CborDecodeError('bytes are not canonical');
  return value;
}
