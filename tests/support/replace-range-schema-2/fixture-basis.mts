// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Hand-written basis states. A spec states the facts a node claims; anything
// not overridden is the honest value computed from its children's claims.
// Overrides (claimed metrics, raw atoms, stored ids, edges) build the malformed
// states the obstructed rows need. Nothing here consults an implementation.
import { createHash } from 'node:crypto';
import { blake3 } from './blake3.mts';
import { concatBytes, contentEdgeId, contentNodeId, hex, OutgoingEdge, slotEdgeId } from './content-address-v1.mts';
import { EdgeRecord, GraphState, NodeRecord } from './graph.mts';
import { atomTypeId, bufferId, edgeTypeId, encodeFact, nodeTypeId, WARP_ID } from './schema-2-facts.mts';
import type { EdgeKind, FactKind } from './schema-2-facts.mts';

const ENCODER = new TextEncoder();
const OBSERVATION_DOMAIN = ENCODER.encode('jedit.text.fixture-observation.v1\0');

export type Bytes = Uint8Array;

/** Line breaks counted here, not with the model's helper, so a shared bug cannot agree with itself. */
function newlines(bytes: Bytes): bigint {
  let count = 0n;
  for (const byte of bytes) if (byte === 10) count += 1n;
  return count;
}

export function utf8(text: string): Bytes {
  return ENCODER.encode(text);
}

export function repeat(text: string, count: number): Bytes {
  return utf8(text.repeat(count));
}

export class NodeOverrides {
  readonly claims: ReadonlyMap<string, bigint>;
  readonly atom: Bytes | null;
  readonly id: Bytes | null;
  readonly edges: readonly (readonly [EdgeKind, TreeSpec | 'self'])[] | null;
  constructor(options: { claims?: ReadonlyMap<string, bigint>; atom?: Bytes; id?: Bytes;
    edges?: readonly (readonly [EdgeKind, TreeSpec | 'self'])[] }) {
    this.claims = options.claims ?? new Map();
    this.atom = options.atom ?? null;
    this.id = options.id ?? null;
    this.edges = options.edges ?? null;
  }
}

export class LeafSpec {
  readonly bytes: Bytes;
  readonly overrides: NodeOverrides;
  constructor(bytes: Bytes, overrides: NodeOverrides) {
    this.bytes = bytes;
    this.overrides = overrides;
  }
}

export class BranchSpec {
  readonly left: TreeSpec;
  readonly right: TreeSpec | 'self';
  readonly overrides: NodeOverrides;
  constructor(left: TreeSpec, right: TreeSpec | 'self', overrides: NodeOverrides) {
    this.left = left;
    this.right = right;
    this.overrides = overrides;
  }
}

export type TreeSpec = LeafSpec | BranchSpec;

export class HeadSpec {
  readonly tree: TreeSpec | null;
  readonly overrides: NodeOverrides;
  constructor(tree: TreeSpec | null, overrides: NodeOverrides) {
    this.tree = tree;
    this.overrides = overrides;
  }
}

export class BufferSpec {
  readonly key: string;
  readonly version: bigint;
  readonly canonical: HeadSpec;
  readonly otherHeads: readonly HeadSpec[];
  readonly importFrom: string;
  readonly importText: Bytes | null;
  readonly atom: Bytes | null;
  constructor(key: string, canonical: HeadSpec, options: { version?: bigint; otherHeads?: readonly HeadSpec[];
    importFrom?: string; importText?: Bytes; atom?: Bytes }) {
    this.key = key;
    this.version = options.version ?? 0n;
    this.canonical = canonical;
    this.otherHeads = options.otherHeads ?? [];
    this.importFrom = options.importFrom ?? key;
    this.importText = options.importText ?? null;
    this.atom = options.atom ?? null;
  }
}

/** One materialized node: its claims, its text, and whether normal admission could store it. */
class Built {
  readonly id: Bytes;
  readonly claims: ReadonlyMap<string, bigint>;
  readonly text: Bytes;
  constructor(id: Bytes, claims: ReadonlyMap<string, bigint>, text: Bytes) {
    this.id = id;
    this.claims = claims;
    this.text = text;
  }
}

export class MaterializedBuffer {
  readonly key: string;
  readonly bufferId: Bytes;
  readonly canonicalHead: Bytes;
  readonly otherHeads: readonly Bytes[];
  constructor(key: string, bufferIdBytes: Bytes, canonicalHead: Bytes, otherHeads: readonly Bytes[]) {
    this.key = key;
    this.bufferId = bufferIdBytes;
    this.canonicalHead = canonicalHead;
    this.otherHeads = otherHeads;
  }
}

export class Basis {
  readonly graph = new GraphState();
  readonly buffers = new Map<string, MaterializedBuffer>();
  /** Content nodes whose stored id is not the ContentAddressV1 address of what they store. */
  readonly injected = new Set<string>();
  readonly texts = new Map<string, Bytes>();

  constructor(buffers: readonly BufferSpec[]) {
    for (const spec of buffers) this.buffers.set(spec.key, this.buffer(spec, buffers));
  }

  buffer(spec: BufferSpec, all: readonly BufferSpec[]): MaterializedBuffer {
    const source = all.find((candidate) => candidate.key === spec.importFrom) ?? spec;
    const importText = source.importText ?? this.treeText(source.canonical.tree);
    const fileCoordinate = `fixture:${source.key}`;
    const observation = blake3(concatBytes([OBSERVATION_DOMAIN, utf8(source.key)]));
    const hostDigest = new Uint8Array(createHash('sha256').update(importText).digest());
    const importId = this.content('Import', new Map<string, bigint | Bytes | string>([['fileCoordinate', fileCoordinate],
      ['hostDigest', hostDigest], ['observation', observation]]), []);
    const hostBasis = this.content('HostBasis', new Map<string, bigint | Bytes | string>([
      ['fileCoordinate', fileCoordinate], ['hostDigest', hostDigest], ['evidence', observation], ['generation', 0n]]), []);
    const id = bufferId(spec.key);
    const atom = spec.atom ?? encodeFact(new Map<string, bigint | string>([['bufferKey', spec.key],
      ['version', spec.version]]));
    this.graph.putNode(new NodeRecord(id, nodeTypeId('Buffer'), atomTypeId('Buffer'), atom));
    const canonical = this.head(spec.canonical, importId);
    this.slot(id, 'canonicalHead', canonical);
    this.slot(id, 'acceptedHostBasis', hostBasis);
    return new MaterializedBuffer(spec.key, id, canonical,
      spec.otherHeads.map((other) => this.head(other, importId)));
  }

  treeText(tree: TreeSpec | null): Bytes {
    if (tree === null) return new Uint8Array();
    if (tree instanceof LeafSpec) return tree.bytes;
    return concatBytes([this.treeText(tree.left), tree.right === 'self' ? new Uint8Array() : this.treeText(tree.right)]);
  }

  slot(from: Bytes, kind: EdgeKind, to: Bytes): void {
    this.graph.putEdge(new EdgeRecord(slotEdgeId(WARP_ID, from, edgeTypeId(kind)), from, edgeTypeId(kind), to));
  }

  /** Stores a content node with its edges; a stored-id override marks it injected. */
  content(kind: FactKind, fields: ReadonlyMap<string, bigint | Bytes | string>,
    edges: readonly (readonly [EdgeKind, Bytes])[], overrides?: NodeOverrides): Bytes {
    const atom = overrides?.atom ?? encodeFact(fields);
    const outgoing = edges.map(([edgeKind, to]) => new OutgoingEdge(edgeTypeId(edgeKind), to));
    const address = contentNodeId(WARP_ID, nodeTypeId(kind), atomTypeId(kind), atom, outgoing);
    const id = overrides?.id ?? address;
    if (hex(id) !== hex(address)) this.injected.add(hex(id));
    this.graph.putNode(new NodeRecord(id, nodeTypeId(kind), atomTypeId(kind), atom));
    for (const [edgeKind, to] of edges) {
      this.graph.putEdge(new EdgeRecord(contentEdgeId(WARP_ID, id, edgeTypeId(edgeKind), to), id, edgeTypeId(edgeKind),
        to));
    }
    return id;
  }

  head(spec: HeadSpec, importId: Bytes): Bytes {
    const root = spec.tree === null ? null : this.tree(spec.tree);
    const claims = new Map<string, bigint>([['byteLength', root?.claims.get('byteLength') ?? 0n],
      ['lineCount', (root?.claims.get('lineBreaks') ?? 0n) + 1n], ['sequence', 0n], ...spec.overrides.claims]);
    const edges: (readonly [EdgeKind, Bytes])[] = root === null ? [] : [['root', root.id]];
    edges.push(['anchor', importId]);
    const id = this.content('Head', claims, edges, spec.overrides);
    this.texts.set(hex(id), root?.text ?? new Uint8Array());
    return id;
  }

  /** An edge target: the node's own stored id for 'self', a child already built, or a newly built tree. */
  edgeTarget(target: TreeSpec | 'self', ownId: Bytes | null, built: ReadonlyMap<TreeSpec, Bytes> | null): Bytes {
    if (target === 'self') {
      if (ownId === null) throw new Error('a self edge needs an id override: no content id can name itself');
      return ownId;
    }
    return built?.get(target) ?? this.tree(target).id;
  }

  tree(spec: TreeSpec): Built {
    if (spec instanceof LeafSpec) {
      const claims = new Map<string, bigint>([['lineBreaks', newlines(spec.bytes)], ...spec.overrides.claims]);
      const fields = new Map<string, bigint | Bytes>([['bytes', spec.bytes], ['lineBreaks', claims.get('lineBreaks')!]]);
      const edges = (spec.overrides.edges ?? []).map(([kind, target]) =>
        [kind, this.edgeTarget(target, spec.overrides.id, null)] as const);
      const id = this.content('Leaf', fields, edges, spec.overrides);
      return new Built(id, new Map([['byteLength', BigInt(spec.bytes.length)], ['height', 1n], ...claims]), spec.bytes);
    }
    const left = this.tree(spec.left);
    const right = spec.right === 'self' ? null : this.tree(spec.right);
    const claims = new Map<string, bigint>(
      ['byteLength', 'lineBreaks'].map((name) => [name, left.claims.get(name)! + (right?.claims.get(name) ?? 0n)]));
    claims.set('height', 1n + [left, right].reduce((tallest, child) =>
      (child !== null && child.claims.get('height')! > tallest ? child.claims.get('height')! : tallest), 0n));
    for (const [name, value] of spec.overrides.claims) claims.set(name, value);
    const built = new Map<TreeSpec, Bytes>([[spec.left, left.id]]);
    if (right !== null && spec.right !== 'self') built.set(spec.right, right.id);
    const edges = (spec.overrides.edges ?? [['left', spec.left], ['right', spec.right]]).map(([kind, target]) =>
      [kind, this.edgeTarget(target, spec.overrides.id, built)] as const);
    const id = this.content('Branch', claims, edges, spec.overrides);
    return new Built(id, claims, concatBytes([left.text, right?.text ?? new Uint8Array()]));
  }
}
