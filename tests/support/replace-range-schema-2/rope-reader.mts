// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Reads and validates stored rope nodes through a recording view.
// A leaf is validated when its atom is decoded; a branch when it is expanded:
// edge structure, identity, then its children's decoded claims (checked sums,
// equality, height, balance). A parent never trusts a child it has not decoded.
import { contentNodeId, hex, OutgoingEdge } from './content-address-v1.mts';
import { atomTypeId, bytesField, decodeFact, EDGE_KINDS, edgeTypeId, FactDecodeError, MAX_LEAF_BYTES, nodeTypeId, U64_MAX,
  uintField, WARP_ID } from './schema-2-facts.mts';
import type { EdgeKind, FactFields, FactKind } from './schema-2-facts.mts';
import type { EdgeRecord, RecordingView } from './graph.mts';
import { Obstruction } from './outcomes.mts';
import type { Outcome } from './outcomes.mts';

const VALIDATION = 'closure-validation';
const BRANCH_EDGES: ReadonlyMap<EdgeKind, readonly [number, number]> = new Map([['left', [1, 1]], ['right', [1, 1]]]);

/** A stored rope node as its decoded atom claims it. */
export class StoredNode {
  readonly id: Uint8Array;
  readonly isLeaf: boolean;
  readonly byteLength: bigint;
  readonly lineBreaks: bigint;
  readonly height: bigint;
  readonly bytes: Uint8Array;
  constructor(id: Uint8Array, isLeaf: boolean, metrics: readonly [bigint, bigint, bigint], bytes: Uint8Array) {
    this.id = id;
    this.isLeaf = isLeaf;
    [this.byteLength, this.lineBreaks, this.height] = metrics;
    this.bytes = bytes;
  }
}

export function countLineBreaks(bytes: Uint8Array): bigint {
  return BigInt(bytes.filter((byte) => byte === 0x0a).length);
}

export function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return hex(left) === hex(right);
}

export class RopeReader {
  readonly view: RecordingView;
  readonly expanded = new Map<string, readonly [StoredNode, StoredNode]>();
  /** When set, closure-validation findings that leave usable data are recorded instead of thrown. */
  lenient = false;

  constructor(view: RecordingView) {
    this.view = view;
  }

  /** Rejects at closure validation, unless the reader is lenient (used only to verify competing checks). */
  reject(outcome: Outcome, detail: string): void {
    if (!this.lenient) throw new Obstruction(outcome, VALIDATION, detail);
  }

  add(left: bigint, right: bigint, what: string): bigint {
    const sum = left + right;
    if (sum > U64_MAX) this.reject('ArithmeticOverflow', `${what} overflows U64`);
    return sum;
  }

  kindOf(nodeType: Uint8Array): FactKind | undefined {
    if (sameBytes(nodeType, nodeTypeId('Leaf'))) return 'Leaf';
    if (sameBytes(nodeType, nodeTypeId('Branch'))) return 'Branch';
    return undefined;
  }

  decode(kind: FactKind, atomType: Uint8Array, atom: Uint8Array, id: Uint8Array): FactFields {
    if (!sameBytes(atomType, atomTypeId(kind))) {
      throw new Obstruction('FactMalformed', VALIDATION, `${hex(id)} carries a foreign atom type`);
    }
    try {
      return decodeFact(kind, atom);
    } catch (error) {
      if (error instanceof FactDecodeError) throw new Obstruction('FactMalformed', VALIDATION, error.message);
      throw error;
    }
  }

  /** Decodes a rope node's atom; a leaf is also fully validated here. */
  describe(id: Uint8Array): StoredNode {
    const record = this.view.node(id);
    if (record === undefined) throw new Obstruction('MalformedRope', VALIDATION, `dangling edge to ${hex(id)}`);
    const kind = this.kindOf(record.nodeType);
    if (kind === undefined) throw new Obstruction('MalformedRope', VALIDATION, `${hex(id)} is not a rope node`);
    const fields = this.decode(kind, record.atomType, record.atom, id);
    if (kind === 'Branch') {
      const metrics = [uintField(fields, 'byteLength'), uintField(fields, 'lineBreaks'),
        uintField(fields, 'height')] as const;
      return new StoredNode(id, false, metrics, new Uint8Array());
    }
    return this.leaf(record.id, record.atomType, record.atom, fields);
  }

  /**
   * Reads every schema edge type from a node and checks each count against `allowed` (a kind not listed
   * allows none). Identity is then computed over this complete set, as ContentAddressV1 requires.
   */
  edgeSet(id: Uint8Array, allowed: ReadonlyMap<EdgeKind, readonly [number, number]>): Map<EdgeKind, EdgeRecord[]> {
    const edges = new Map<EdgeKind, EdgeRecord[]>();
    for (const kind of EDGE_KINDS) {
      const found = this.view.edges(id, edgeTypeId(kind));
      const [min, max] = allowed.get(kind) ?? [0, 0];
      if (found.length < min || found.length > max) {
        throw new Obstruction('MalformedRope', VALIDATION, `${hex(id)} has ${found.length} ${kind} edges`);
      }
      edges.set(kind, found);
    }
    return edges;
  }

  static outgoing(edges: ReadonlyMap<EdgeKind, readonly EdgeRecord[]>): OutgoingEdge[] {
    return [...edges.values()].flat().map((edge) => new OutgoingEdge(edge.edgeType, edge.to));
  }

  leaf(id: Uint8Array, atomType: Uint8Array, atom: Uint8Array, fields: FactFields): StoredNode {
    const bytes = bytesField(fields, 'bytes');
    this.edgeSet(id, new Map());
    if (!sameBytes(contentNodeId(WARP_ID, nodeTypeId('Leaf'), atomType, atom, []), id)) {
      this.reject('ContentIdentityMismatch', `leaf ${hex(id)} is not its content address`);
    }
    if (bytes.length === 0 || bytes.length > MAX_LEAF_BYTES) {
      this.reject('MalformedRope', `leaf ${hex(id)} holds ${bytes.length} bytes`);
    }
    if (!isUtf8(bytes)) this.reject('MalformedRope', `leaf ${hex(id)} is not UTF-8`);
    if (countLineBreaks(bytes) !== uintField(fields, 'lineBreaks')) {
      this.reject('MalformedRope', `leaf ${hex(id)} line breaks do not match its bytes`);
    }
    return new StoredNode(id, true, [BigInt(bytes.length), countLineBreaks(bytes), 1n], bytes);
  }

  /** Expands a branch into its two children, validating the branch on the way. */
  expand(branch: StoredNode): readonly [StoredNode, StoredNode] {
    const cached = this.expanded.get(hex(branch.id));
    if (cached !== undefined) return cached;
    const edges = this.edgeSet(branch.id, BRANCH_EDGES);
    const [left, right] = [edges.get('left')![0]!.to, edges.get('right')![0]!.to];
    const record = this.view.node(branch.id)!;
    const outgoing = RopeReader.outgoing(edges);
    if (!sameBytes(contentNodeId(WARP_ID, nodeTypeId('Branch'), record.atomType, record.atom, outgoing), branch.id)) {
      this.reject('ContentIdentityMismatch', `branch ${hex(branch.id)} is not its address`);
    }
    const children = [this.describe(left), this.describe(right)] as const;
    this.checkBranch(branch, children);
    this.expanded.set(hex(branch.id), children);
    return children;
  }

  checkBranch(branch: StoredNode, [left, right]: readonly [StoredNode, StoredNode]): void {
    const where = `branch ${hex(branch.id)}`;
    const byteLength = this.add(left.byteLength, right.byteLength, `${where} byte length`);
    const lineBreaks = this.add(left.lineBreaks, right.lineBreaks, `${where} line breaks`);
    if (byteLength !== branch.byteLength) this.reject('MalformedRope', `${where} extent`);
    if (lineBreaks !== branch.lineBreaks) this.reject('MalformedRope', `${where} line breaks`);
    const tallest = left.height > right.height ? left.height : right.height;
    if (branch.height !== tallest + 1n) this.reject('MalformedRope', `${where} height`);
    const skew = left.height - right.height;
    if (skew > 1n || skew < -1n) this.reject('MalformedRope', `${where} is not AVL-balanced`);
  }
}
