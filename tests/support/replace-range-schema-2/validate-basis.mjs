// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Independent rope-law and record checks over artifact JSON: whether a stored
// head is a lawful schema-2 rope, written from DL-0159's rope law rather than
// from the specification model. It classifies a basis only as lawful or unlawful:
// rows decided at closure validation must store an unlawful rope and other rows
// (counters excepted) a lawful one. It does not show which fault, or that the
// deciding check is the first to fail; the builder's consistency check and the
// hand-written outcome list in validator-oracle.mjs carry that. It also checks
// that created nodes have lawful edge shapes.
import { CborBytes, CborMap, CborText, CborUint, decodeCanonicalCbor } from './canonical-cbor.mts';
import { unhex } from './content-address-v1.mts';
import { RECORDS } from './validator-oracle.mjs';

const U64_MAX = 0xffff_ffff_ffff_ffffn;
const MAX_LEAF_BYTES = 4096;
const DIGEST_FIELDS = new Set(['hostDigest', 'observation', 'evidence']);
const TEXT_FIELDS = new Set(['bufferKey', 'fileCoordinate']);
/** Allowed outgoing edges per node type: [type, min, max]; any other type allows none. */
const SHAPES = new Map([
  ['Head', [['root', 0, 1], ['anchor', 1, 1]]],
  ['Branch', [['left', 1, 1], ['right', 1, 1]]],
  ['Leaf', []], ['Import', []], ['HostBasis', []],
  ['Buffer', [['canonicalHead', 1, 1], ['acceptedHostBasis', 1, 1]]],
]);

function fieldOk(name, value) {
  if (name === 'bytes') return value instanceof CborBytes && value.value.length <= MAX_LEAF_BYTES;
  if (DIGEST_FIELDS.has(name)) return value instanceof CborBytes && value.value.length === 32;
  if (TEXT_FIELDS.has(name)) return value instanceof CborText;
  if (name === 'height') return value instanceof CborUint && value.value <= 255n;
  return value instanceof CborUint;
}

/** Whether an atom is a canonical closed record of its type with every field of the declared kind and bound. */
export function decodesAsRecord(type, atomHex) {
  let value;
  try {
    value = decodeCanonicalCbor(unhex(atomHex));
  } catch {
    return false;
  }
  const fields = RECORDS.get(type);
  if (!(value instanceof CborMap) || fields === undefined) return false;
  if ([...value.entries.keys()].sort().join() !== fields.join()) return false;
  return [...value.entries].every(([name, field]) => fieldOk(name, field));
}

/** Whether a node's outgoing edges have the shape its type allows. */
export function shapeOk(type, edges) {
  const allowed = SHAPES.get(type) ?? [];
  const counts = new Map();
  for (const edge of edges) counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
  for (const [kind, min, max] of allowed) {
    const count = counts.get(kind) ?? 0;
    if (count < min || count > max) return false;
    counts.delete(kind);
  }
  return counts.size === 0;
}

class Unlawful extends Error {}

function walk(nodes, edges, id) {
  const node = nodes.get(id);
  const out = edges.filter((edge) => edge.from === id);
  if (node === undefined || node.admission !== 'bridge-admissible' || !shapeOk(node.type, out)
    || !decodesAsRecord(node.type, node.atomHex) || 'undecodable' in node.fact) throw new Unlawful(id);
  if (node.type === 'Leaf') {
    const bytes = unhex(node.fact.bytes);
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Unlawful(id);
    }
    const breaks = BigInt(bytes.filter((byte) => byte === 0x0a).length);
    if (bytes.length === 0 || breaks !== BigInt(node.fact.lineBreaks)) throw new Unlawful(id);
    return { length: BigInt(bytes.length), breaks, height: 1n };
  }
  if (node.type !== 'Branch') throw new Unlawful(id);
  const [l, r] = ['left', 'right'].map((kind) => walk(nodes, edges, out.find((edge) => edge.type === kind).to));
  const length = l.length + r.length;
  const breaks = l.breaks + r.breaks;
  const height = 1n + (l.height > r.height ? l.height : r.height);
  if (length > U64_MAX || breaks > U64_MAX || String(length) !== node.fact.byteLength
    || String(breaks) !== node.fact.lineBreaks || String(height) !== node.fact.height
    || l.height - r.height > 1n || r.height - l.height > 1n) throw new Unlawful(id);
  return { length, breaks, height };
}

/** Whether the head at `headId` stores a lawful schema-2 rope (identity, records, shapes, metrics, AVL). */
export function headIsLawful(row, headId) {
  const nodes = new Map(row.basis.nodes.map((node) => [node.id, node]));
  const head = nodes.get(headId);
  const out = row.basis.edges.filter((edge) => edge.from === headId);
  if (head === undefined || head.admission !== 'bridge-admissible' || !shapeOk('Head', out)
    || !decodesAsRecord('Head', head.atomHex)) return false;
  const root = out.find((edge) => edge.type === 'root');
  try {
    const metrics = root === undefined ? { length: 0n, breaks: 0n } : walk(nodes, row.basis.edges, root.to);
    return String(metrics.length) === head.fact.byteLength && String(metrics.breaks + 1n) === head.fact.lineCount
      && metrics.breaks + 1n <= U64_MAX;
  } catch (error) {
    if (error instanceof Unlawful || error instanceof TypeError) return false;
    throw error;
  }
}
