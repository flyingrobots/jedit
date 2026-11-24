// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Schema-2 facts (DL-0159, Facts) and their fixture-declared identity labels.
// The labels stand in for the unpublished jedit.text@2 lawpack; changing them
// is a reviewed regeneration of every id, never an adjustment to an output.
import { CborBytes, CborMap, CborText, CborUint, decodeCanonicalCbor, encodeCbor } from './canonical-cbor.mts';
import type { CborValue } from './canonical-cbor.mts';
import { blake3 } from './blake3.mts';
import { concatBytes, labelId } from './content-address-v1.mts';

export const U64_MAX = 0xffff_ffff_ffff_ffffn;
export const U8_MAX = 0xffn;
export const MAX_LEAF_BYTES = 4096;
export const MAX_STRING_BYTES = 4096;
export const DIGEST_BYTES = 32;

export const LABELS = Object.freeze({
  warp: 'jedit.text.schema@2/acceptance-fixtures',
  bufferKeyDomain: 'jedit.text.buffer-key.v2\0',
  nodeTypes: Object.freeze({
    Buffer: 'jedit.text.v2.Buffer', Head: 'jedit.text.v2.Head', Branch: 'jedit.text.v2.Branch',
    Leaf: 'jedit.text.v2.Leaf', Import: 'jedit.text.v2.Import', HostBasis: 'jedit.text.v2.HostBasis',
  }),
  atomTypes: Object.freeze({
    Buffer: 'jedit.text.v2.BufferFact', Head: 'jedit.text.v2.HeadFact', Branch: 'jedit.text.v2.BranchFact',
    Leaf: 'jedit.text.v2.LeafFact', Import: 'jedit.text.v2.ImportFact', HostBasis: 'jedit.text.v2.HostBasisFact',
  }),
  edgeTypes: Object.freeze({
    canonicalHead: 'jedit.text.canonicalHead', acceptedHostBasis: 'jedit.text.acceptedHostBasis',
    root: 'jedit.text.root', anchor: 'jedit.text.anchor', left: 'jedit.text.left', right: 'jedit.text.right',
  }),
});

export type FactKind = keyof typeof LABELS.nodeTypes;
export type EdgeKind = keyof typeof LABELS.edgeTypes;

export const FACT_KINDS: readonly FactKind[] = ['Buffer', 'Head', 'Branch', 'Leaf', 'Import', 'HostBasis'];
export const EDGE_KINDS: readonly EdgeKind[] = ['canonicalHead', 'acceptedHostBasis', 'root', 'anchor', 'left', 'right'];

export const WARP_ID = labelId('warp:', LABELS.warp);
export const NODE_TYPE_IDS: ReadonlyMap<FactKind, Uint8Array> = new Map(
  FACT_KINDS.map((kind) => [kind, labelId('type:', LABELS.nodeTypes[kind])]));
export const ATOM_TYPE_IDS: ReadonlyMap<FactKind, Uint8Array> = new Map(
  FACT_KINDS.map((kind) => [kind, labelId('type:', LABELS.atomTypes[kind])]));
export const EDGE_TYPE_IDS: ReadonlyMap<EdgeKind, Uint8Array> = new Map(
  EDGE_KINDS.map((kind) => [kind, labelId('type:', LABELS.edgeTypes[kind])]));

export function nodeTypeId(kind: FactKind): Uint8Array {
  return NODE_TYPE_IDS.get(kind)!;
}

export function atomTypeId(kind: FactKind): Uint8Array {
  return ATOM_TYPE_IDS.get(kind)!;
}

export function edgeTypeId(kind: EdgeKind): Uint8Array {
  return EDGE_TYPE_IDS.get(kind)!;
}

export function bufferId(bufferKey: string): Uint8Array {
  const encoder = new TextEncoder();
  return blake3(concatBytes([encoder.encode(LABELS.bufferKeyDomain), encoder.encode(bufferKey)]));
}

/** One field of a closed record: its name and how it decodes. */
type FieldDecoder = (value: CborValue) => bigint | Uint8Array | string;

export class FactDecodeError extends Error {}

function uint(max: bigint): FieldDecoder {
  return (value) => {
    if (!(value instanceof CborUint) || value.value > max) throw new FactDecodeError('expected an unsigned integer');
    return value.value;
  };
}

function bytes(maxLength: number, exact: boolean): FieldDecoder {
  return (value) => {
    if (!(value instanceof CborBytes)) throw new FactDecodeError('expected a byte string');
    const ok = exact ? value.value.length === maxLength : value.value.length <= maxLength;
    if (!ok) throw new FactDecodeError(`byte string length ${value.value.length} outside its bound`);
    return value.value;
  };
}

function text(maxBytes: number): FieldDecoder {
  return (value) => {
    if (!(value instanceof CborText)) throw new FactDecodeError('expected a text string');
    if (new TextEncoder().encode(value.value).length > maxBytes) throw new FactDecodeError('text exceeds its bound');
    return value.value;
  };
}

const U64 = uint(U64_MAX);
const DIGEST = bytes(DIGEST_BYTES, true);
const SCHEMAS: ReadonlyMap<FactKind, ReadonlyMap<string, FieldDecoder>> = new Map([
  ['Buffer', new Map([['bufferKey', text(MAX_STRING_BYTES)], ['version', U64]])],
  ['Head', new Map([['byteLength', U64], ['lineCount', U64], ['sequence', U64]])],
  ['Branch', new Map([['byteLength', U64], ['lineBreaks', U64], ['height', uint(U8_MAX)]])],
  ['Leaf', new Map([['bytes', bytes(MAX_LEAF_BYTES, false)], ['lineBreaks', U64]])],
  ['Import', new Map([['fileCoordinate', text(MAX_STRING_BYTES)], ['hostDigest', DIGEST], ['observation', DIGEST]])],
  ['HostBasis', new Map([['fileCoordinate', text(MAX_STRING_BYTES)], ['hostDigest', DIGEST], ['evidence', DIGEST],
    ['generation', U64]])],
]);

export type FactFields = ReadonlyMap<string, bigint | Uint8Array | string>;

export function uintField(fields: FactFields, name: string): bigint {
  const value = fields.get(name);
  if (typeof value !== 'bigint') throw new FactDecodeError(`field ${name} is not an unsigned integer`);
  return value;
}

export function bytesField(fields: FactFields, name: string): Uint8Array {
  const value = fields.get(name);
  if (!(value instanceof Uint8Array)) throw new FactDecodeError(`field ${name} is not a byte string`);
  return value;
}

export function textField(fields: FactFields, name: string): string {
  const value = fields.get(name);
  if (typeof value !== 'string') throw new FactDecodeError(`field ${name} is not a text string`);
  return value;
}

function toCbor(value: bigint | Uint8Array | string): CborValue {
  if (typeof value === 'bigint') return new CborUint(value);
  if (typeof value === 'string') return new CborText(value);
  return new CborBytes(value);
}

/** Canonical atom bytes for fields given in any order; no bound is checked. */
export function encodeFact(fields: FactFields): Uint8Array {
  return encodeCbor(new CborMap(new Map([...fields].map(([name, value]) => [name, toCbor(value)]))));
}

/** Decode a stored atom as a closed record of `kind`, enforcing every bound. */
export function decodeFact(kind: FactKind, atom: Uint8Array): FactFields {
  let value: CborValue;
  try {
    value = decodeCanonicalCbor(atom);
  } catch (error) {
    throw new FactDecodeError(`${kind} atom is not canonical CBOR: ${String(error)}`);
  }
  if (!(value instanceof CborMap)) throw new FactDecodeError(`${kind} atom is not a map`);
  const schema = SCHEMAS.get(kind)!;
  const names = [...value.entries.keys()].sort();
  if (names.join(',') !== [...schema.keys()].sort().join(',')) {
    throw new FactDecodeError(`${kind} atom fields ${names.join(',')} are not the closed record`);
  }
  return new Map([...schema].map(([name, decode]) => [name, decode(value.entries.get(name)!)]));
}
