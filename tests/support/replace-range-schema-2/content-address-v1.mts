// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Echo identity law 1, ContentAddressV1, transcribed field by field from
// docs/architecture/authored-operation-effects.md ("Identity laws"). Echo's
// frozen vectors in content_address_v1_tests.rs pin this transcription.
import { blake3 } from './blake3.mts';

const ENCODER = new TextEncoder();
const ATTACHMENT_VALUE_DOMAIN = ENCODER.encode('echo.bridge.attachment-value.v1\0');
const NODE_ID_DOMAIN = ENCODER.encode('echo.bridge.node-id.v1\0');
const CONTENT_EDGE_ID_DOMAIN = ENCODER.encode('echo.bridge.edge-id.v1\0');
const SLOT_EDGE_ID_DOMAIN = ENCODER.encode('echo.bridge.slot-edge-id.v1\0');
const ATOM_ATTACHMENT_TAG = 0;
const ID_BYTES = 32;

export class DuplicateOutgoingEdgeError extends Error {}

export class OutgoingEdge {
  readonly edgeType: Uint8Array;
  readonly to: Uint8Array;
  constructor(edgeType: Uint8Array, to: Uint8Array) {
    if (edgeType.length !== ID_BYTES || to.length !== ID_BYTES) throw new RangeError('edge ids are 32 bytes');
    this.edgeType = edgeType;
    this.to = to;
  }
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return left.length - right.length;
}

function u64le(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
  return out;
}

export function attachmentDigest(atomType: Uint8Array, atom: Uint8Array): Uint8Array {
  return blake3(concatBytes([ATTACHMENT_VALUE_DOMAIN, Uint8Array.of(ATOM_ATTACHMENT_TAG), atomType,
    u64le(atom.length), atom]));
}

function compareEdges(left: OutgoingEdge, right: OutgoingEdge): number {
  return compareBytes(left.edgeType, right.edgeType) || compareBytes(left.to, right.to);
}

export function contentNodeId(warp: Uint8Array, nodeType: Uint8Array, atomType: Uint8Array, atom: Uint8Array,
  outgoing: readonly OutgoingEdge[]): Uint8Array {
  const sorted = [...outgoing].sort(compareEdges);
  for (let index = 1; index < sorted.length; index += 1) {
    if (compareEdges(sorted[index - 1]!, sorted[index]!) === 0) {
      throw new DuplicateOutgoingEdgeError('the same (edge type, target) appears twice');
    }
  }
  return blake3(concatBytes([NODE_ID_DOMAIN, warp, nodeType, attachmentDigest(atomType, atom),
    u64le(sorted.length), ...sorted.flatMap((edge) => [edge.edgeType, edge.to])]));
}

export function contentEdgeId(warp: Uint8Array, from: Uint8Array, edgeType: Uint8Array, to: Uint8Array): Uint8Array {
  return blake3(concatBytes([CONTENT_EDGE_ID_DOMAIN, warp, from, edgeType, to]));
}

export function slotEdgeId(warp: Uint8Array, from: Uint8Array, edgeType: Uint8Array): Uint8Array {
  return blake3(concatBytes([SLOT_EDGE_ID_DOMAIN, warp, from, edgeType]));
}

export function labelId(prefix: string, label: string): Uint8Array {
  return blake3(ENCODER.encode(prefix + label));
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function unhex(text: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/.test(text)) throw new RangeError('not lowercase hex');
  return Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}
