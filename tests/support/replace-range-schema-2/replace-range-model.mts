// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Specification model of schema-2 ReplaceRange, used only to derive fixture
// expectations. It shares no code with the native planner or authored source.
// Every state read goes through a RecordingView, so its footprint is observed.
import { contentNodeId, hex } from './content-address-v1.mts';
import { RecordingView } from './graph.mts';
import type { GraphState, NodeRecord } from './graph.mts';
import { Obstruction } from './outcomes.mts';
import type { Check } from './outcomes.mts';
import { byteLength, fromBytes, isCharBoundary, lineBreaks, NewBranch, NewLeaf, RopeBuilder } from './rope-build.mts';
import type { Rope } from './rope-build.mts';
import { checkedAdd, isUtf8, RopeReader } from './rope-reader.mts';
import type { StoredNode } from './rope-reader.mts';
import { atomTypeId, decodeFact, edgeTypeId, FactDecodeError, MAX_LEAF_BYTES, nodeTypeId, textField, uintField,
  U64_MAX, WARP_ID } from './schema-2-facts.mts';
import type { EdgeKind, FactFields, FactKind } from './schema-2-facts.mts';

export class Invocation {
  readonly bufferId: Uint8Array;
  readonly basisHeadId: Uint8Array;
  readonly start: bigint;
  readonly end: bigint;
  readonly replacement: Uint8Array;
  constructor(bufferId: Uint8Array, basisHeadId: Uint8Array, range: readonly [bigint, bigint], replacement: Uint8Array) {
    this.bufferId = bufferId;
    this.basisHeadId = basisHeadId;
    [this.start, this.end] = range;
    this.replacement = replacement;
  }
}

/** What a committed run proposes: the new head, its tree and the Buffer update. */
export class ModelCommit {
  readonly view: RecordingView;
  readonly basisHeadId: Uint8Array;
  readonly root: Rope | null;
  readonly anchor: Uint8Array;
  readonly headFields: FactFields;
  readonly bufferFields: FactFields;
  constructor(view: RecordingView, head: readonly [Uint8Array, Rope | null, Uint8Array], fields: readonly [FactFields,
    FactFields]) {
    this.view = view;
    [this.basisHeadId, this.root, this.anchor] = head;
    [this.headFields, this.bufferFields] = fields;
  }
}

export class ModelObstruction {
  readonly view: RecordingView;
  readonly obstruction: Obstruction;
  constructor(view: RecordingView, obstruction: Obstruction) {
    this.view = view;
    this.obstruction = obstruction;
  }
}

const HEAD_EDGES: ReadonlyMap<EdgeKind, readonly [number, number]> = new Map([['root', [0, 1]], ['anchor', [1, 1]]]);

function same(left: Uint8Array, right: Uint8Array): boolean {
  return hex(left) === hex(right);
}

function decodeAt(record: NodeRecord, kind: FactKind, check: 'buffer-decode' | 'head-decode'): FactFields {
  if (!same(record.nodeType, nodeTypeId(kind)) || !same(record.atomType, atomTypeId(kind))) {
    throw new Obstruction('FactMalformed', check, `${hex(record.id)} is not a ${kind}`);
  }
  try {
    return decodeFact(kind, record.atom);
  } catch (error) {
    if (error instanceof FactDecodeError) throw new Obstruction('FactMalformed', check, error.message);
    throw error;
  }
}

function checkedIncrement(value: bigint, what: string): bigint {
  if (value === U64_MAX) throw new Obstruction('ArithmeticOverflow', 'counters', `${what} overflows U64`);
  return value + 1n;
}

type PathStep = readonly [StoredNode, 'left' | 'right'];
type Point = readonly [Uint8Array, bigint];

class Located {
  readonly path: readonly PathStep[];
  readonly leaf: StoredNode | null;
  readonly points: readonly Point[];
  constructor(path: readonly PathStep[], leaf: StoredNode | null, points: readonly Point[]) {
    this.path = path;
    this.leaf = leaf;
    this.points = points;
  }
}

export class ReplaceRangeModel {
  readonly view: RecordingView;
  readonly reader: RopeReader;
  readonly builder: RopeBuilder;
  readonly invocation: Invocation;
  /** Node and range read counts when the first endpoint is classified; null if never reached. */
  readsAtClassification: readonly [number, number] | null = null;

  /** A later check to evaluate as if this one passed; used only to verify a row's competing checks. */
  readonly skip: Check | null;

  constructor(graph: GraphState, invocation: Invocation, skip: Check | null = null) {
    this.skip = skip;
    this.view = new RecordingView(graph);
    this.reader = new RopeReader(this.view);
    this.builder = new RopeBuilder(this.reader);
    this.invocation = invocation;
  }

  run(): ModelCommit | ModelObstruction {
    try {
      return this.replace();
    } catch (error) {
      if (error instanceof Obstruction) return new ModelObstruction(this.view, error);
      throw error;
    }
  }

  replace(): ModelCommit {
    const { bufferId, basisHeadId, start, end, replacement } = this.invocation;
    const buffer = this.view.node(bufferId);
    if (buffer === undefined) throw new Obstruction('FactMissing', 'buffer-presence', `no Buffer ${hex(bufferId)}`);
    const bufferFields = decodeAt(buffer, 'Buffer', 'buffer-decode');
    const canonical = this.view.edges(bufferId, edgeTypeId('canonicalHead'));
    if (canonical.length !== 1 || !same(canonical[0]!.to, basisHeadId)) {
      throw new Obstruction('BasisNotCanonical', 'basis', `basis ${hex(basisHeadId)} is not the canonical head`);
    }
    if (start > end) throw new Obstruction('RangeOrderInvalid', 'range-order', `${start} > ${end}`);
    if (!isUtf8(replacement)) throw new Obstruction('ReplacementNotUtf8', 'replacement', 'replacement bytes');
    const head = this.view.node(basisHeadId);
    if (head === undefined) throw new Obstruction('FactMissing', 'head-decode', `no Head ${hex(basisHeadId)}`);
    const headFields = decodeAt(head, 'Head', 'head-decode');
    if (end > uintField(headFields, 'byteLength')) {
      throw new Obstruction('RangeOutOfBounds', 'range-bounds', `${end} exceeds the head length`);
    }
    const [root, anchor] = this.validateHead(head, headFields);
    const located = root === null ? new Located([], null, []) : this.locate(root);
    // Every node the operation will resolve is read, and so validated, here: the
    // reconstruction and the no-op comparison run before any endpoint is classified.
    const tree = this.construct(root, located);
    const noOp = this.isNoOp(root);
    this.readsAtClassification = [this.view.nodeReads.size, this.view.rangeReads.size];
    if (this.skip !== 'character-boundary') this.checkBoundaries(located);
    if (noOp && this.skip !== 'no-op') throw new Obstruction('NoOp', 'no-op', 'replacement equals the replaced bytes');
    const sequence = checkedIncrement(uintField(headFields, 'sequence'), 'head sequence');
    const version = checkedIncrement(uintField(bufferFields, 'version'), 'buffer version');
    const total = tree === null ? 0n : byteLength(tree);
    const lineCount = (tree === null ? 0n : lineBreaks(tree)) + 1n;
    if (total > U64_MAX || lineCount > U64_MAX) {
      throw new Obstruction('ArithmeticOverflow', 'counters', 'the new head extent or line count overflows U64');
    }
    const newHead = new Map<string, bigint>([['byteLength', total],
      ['lineCount', lineCount], ['sequence', sequence]]);
    const newBuffer = new Map<string, bigint | string>([['bufferKey', textField(bufferFields, 'bufferKey')],
      ['version', version]]);
    return new ModelCommit(this.view, [basisHeadId, tree, anchor], [newHead, newBuffer]);
  }

  validateHead(head: NodeRecord, fields: FactFields): readonly [StoredNode | null, Uint8Array] {
    const edges = this.reader.edgeSet(head.id, HEAD_EDGES);
    const [roots, anchors] = [edges.get('root')!, edges.get('anchor')!];
    const outgoing = RopeReader.outgoing(edges);
    if (!same(contentNodeId(WARP_ID, nodeTypeId('Head'), head.atomType, head.atom, outgoing), head.id)) {
      throw new Obstruction('ContentIdentityMismatch', 'closure-validation', 'head is not its content address');
    }
    const claimed = uintField(fields, 'byteLength');
    const lineCount = uintField(fields, 'lineCount');
    if (roots.length === 0) {
      if (claimed !== 0n || lineCount !== 1n) {
        throw new Obstruction('MalformedRope', 'closure-validation', 'empty head claims text');
      }
      return [null, anchors[0]!.to];
    }
    const root = this.reader.describe(roots[0]!.to);
    if (root.byteLength !== claimed) throw new Obstruction('MalformedRope', 'closure-validation', 'head extent');
    if (checkedAdd(root.lineBreaks, 1n, 'head line count') !== lineCount) {
      throw new Obstruction('MalformedRope', 'closure-validation', 'head line count');
    }
    return [root, anchors[0]!.to];
  }

  /**
   * Descends while one child holds the whole range. A spanning branch descends
   * once more for each endpoint. Every node on these paths is validated before
   * any endpoint is classified, so a malformed closure outranks a bad offset.
   */
  locate(root: StoredNode): Located {
    const path: PathStep[] = [];
    let node = root;
    let [start, end] = [this.invocation.start, this.invocation.end];
    while (!node.isLeaf) {
      const [left, right] = this.reader.expand(node);
      if (end <= left.byteLength) {
        path.push([node, 'left']);
        node = left;
      } else if (start >= left.byteLength) {
        path.push([node, 'right']);
        [node, start, end] = [right, start - left.byteLength, end - left.byteLength];
      } else {
        const points = [this.pointLeaf(left, start), this.pointLeaf(right, end - left.byteLength)];
        return new Located(path, null, points.flatMap((point) => (point === null ? [] : [point])));
      }
    }
    return new Located(path, node, [[node.bytes, start], [node.bytes, end]]);
  }

  /** The leaf holding an offset and the offset within it; null when the offset falls between children. */
  pointLeaf(rope: StoredNode, offset: bigint): readonly [Uint8Array, bigint] | null {
    let [node, local] = [rope, offset];
    while (!node.isLeaf) {
      const [left, right] = this.reader.expand(node);
      if (local === left.byteLength) return null;
      [node, local] = local < left.byteLength ? [left, local] : [right, local - left.byteLength];
    }
    return [node.bytes, local];
  }

  checkBoundaries(located: Located): void {
    for (const [bytes, offset] of located.points) {
      if (!isCharBoundary(bytes, Number(offset))) {
        throw new Obstruction('Utf8BoundaryInvalid', 'character-boundary', 'offset splits a code point');
      }
    }
  }

  isNoOp(root: StoredNode | null): boolean {
    const { start, end, replacement } = this.invocation;
    if (BigInt(replacement.length) !== end - start) return false;
    if (start === end) return true;
    const replaced = this.builder.suffix(this.builder.prefix(root!, end)!, start);
    return hex(this.collect(replaced)) === hex(replacement);
  }

  collect(rope: Rope | null): Uint8Array {
    if (rope === null) return new Uint8Array();
    if (this.builder.isLeaf(rope)) return this.builder.leafBytes(rope);
    const [left, right] = this.builder.children(rope);
    const [head, tail] = [this.collect(left), this.collect(right)];
    const out = new Uint8Array(head.length + tail.length);
    out.set(head);
    out.set(tail, head.length);
    return out;
  }

  construct(root: StoredNode | null, located: Located): Rope | null {
    const fast = this.leafRewrite(located);
    if (fast !== null) return fast;
    const { start, end, replacement } = this.invocation;
    const prefix = root === null ? null : this.builder.prefix(root, start);
    const suffix = root === null ? null : this.builder.suffix(root, end);
    return this.builder.join(this.builder.join(prefix, fromBytes(replacement)), suffix);
  }

  /** An edit inside one leaf whose result is 1-4096 bytes rewrites that leaf and path-copies its ancestors. */
  leafRewrite(located: Located): Rope | null {
    if (located.leaf === null) return null;
    const offset = located.path.reduce((sum, [branch, side]) =>
      (side === 'right' ? sum + this.reader.expand(branch)[0].byteLength : sum), 0n);
    const bytes = located.leaf.bytes;
    const [start, end] = [Number(this.invocation.start - offset), Number(this.invocation.end - offset)];
    const length = bytes.length - (end - start) + this.invocation.replacement.length;
    if (length === 0 || length > MAX_LEAF_BYTES) return null;
    const rewritten = new Uint8Array(length);
    rewritten.set(bytes.subarray(0, start));
    rewritten.set(this.invocation.replacement, start);
    rewritten.set(bytes.subarray(end), start + this.invocation.replacement.length);
    let rope: Rope = new NewLeaf(rewritten);
    for (const [branch, side] of [...located.path].reverse()) {
      const [left, right] = this.reader.expand(branch);
      rope = side === 'left' ? new NewBranch(rope, right) : new NewBranch(left, rope);
    }
    return rope;
  }
}
