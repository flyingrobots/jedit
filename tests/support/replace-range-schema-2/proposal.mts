// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Turns a model commit into the records it creates and Echo-ordered effects
// (authored-operation-effects.md, EffectProposal: slot class, then local id).
import { attachmentDigest, compareBytes, contentEdgeId, contentNodeId, hex, OutgoingEdge, slotEdgeId }
  from './content-address-v1.mts';
import { EdgeRecord, NodeRecord } from './graph.mts';
import type { GraphState } from './graph.mts';
import { NewBranch, NewLeaf } from './rope-build.mts';
import type { Rope } from './rope-build.mts';
import { countLineBreaks } from './rope-reader.mts';
import { atomTypeId, edgeTypeId, encodeFact, nodeTypeId, WARP_ID } from './schema-2-facts.mts';
import type { EdgeKind, FactKind } from './schema-2-facts.mts';
import type { ModelCommit } from './replace-range-model.mts';

export class Effect {
  readonly kind: 'EnsureNode' | 'ReplaceAtom' | 'EnsureEdge' | 'ReplaceEdge';
  readonly slotClass: number;
  readonly slot: Uint8Array;
  readonly fields: ReadonlyMap<string, string>;
  constructor(kind: Effect['kind'], slot: Uint8Array, fields: ReadonlyMap<string, string>) {
    this.kind = kind;
    this.slotClass = { EnsureNode: 0, ReplaceAtom: 1, EnsureEdge: 2, ReplaceEdge: 2 }[kind];
    this.slot = slot;
    this.fields = fields;
  }
}

export class Proposal {
  readonly created = new Map<string, NodeRecord>();
  readonly createdEdges = new Map<string, EdgeRecord>();
  readonly kinds = new Map<string, FactKind>();
  headId: Uint8Array = new Uint8Array();
  bufferAtom: Uint8Array = new Uint8Array();
  bufferId: Uint8Array = new Uint8Array();
  oldBufferAtom: Uint8Array = new Uint8Array();
  oldHead: Uint8Array = new Uint8Array();
  slotEdge: Uint8Array = new Uint8Array();

  node(kind: FactKind, fields: ReadonlyMap<string, bigint | Uint8Array | string>,
    edges: readonly (readonly [EdgeKind, Uint8Array])[]): Uint8Array {
    const atom = encodeFact(fields);
    const outgoing = edges.map(([edgeKind, to]) => new OutgoingEdge(edgeTypeId(edgeKind), to));
    const id = contentNodeId(WARP_ID, nodeTypeId(kind), atomTypeId(kind), atom, outgoing);
    this.created.set(hex(id), new NodeRecord(id, nodeTypeId(kind), atomTypeId(kind), atom));
    this.kinds.set(hex(id), kind);
    for (const [edgeKind, to] of edges) {
      const edgeId = contentEdgeId(WARP_ID, id, edgeTypeId(edgeKind), to);
      this.createdEdges.set(hex(edgeId), new EdgeRecord(edgeId, id, edgeTypeId(edgeKind), to));
    }
    return id;
  }

  rope(rope: Rope): Uint8Array {
    if (rope instanceof NewLeaf) {
      return this.node('Leaf', new Map<string, bigint | Uint8Array>([['bytes', rope.bytes],
        ['lineBreaks', countLineBreaks(rope.bytes)]]), []);
    }
    if (rope instanceof NewBranch) {
      const left = this.rope(rope.left);
      const right = this.rope(rope.right);
      return this.node('Branch', new Map([['byteLength', rope.byteLength], ['lineBreaks', rope.lineBreaks],
        ['height', rope.height]]), [['left', left], ['right', right]]);
    }
    return rope.id;
  }

  effects(): Effect[] {
    const effects: Effect[] = [...this.created.values()].map((record) => new Effect('EnsureNode', record.id,
      new Map([['node', hex(record.id)], ['nodeType', hex(record.nodeType)], ['atomType', hex(record.atomType)],
        ['atomHex', hex(record.atom)]])));
    effects.push(new Effect('ReplaceAtom', this.bufferId, new Map([['node', hex(this.bufferId)],
      ['expectedAtomDigest', hex(attachmentDigest(atomTypeId('Buffer'), this.oldBufferAtom))],
      ['atomType', hex(atomTypeId('Buffer'))], ['atomHex', hex(this.bufferAtom)]])));
    for (const edge of this.createdEdges.values()) {
      effects.push(new Effect('EnsureEdge', edge.id, new Map([['edge', hex(edge.id)], ['from', hex(edge.from)],
        ['edgeType', hex(edge.edgeType)], ['to', hex(edge.to)]])));
    }
    effects.push(new Effect('ReplaceEdge', this.slotEdge, new Map([['edge', hex(this.slotEdge)],
      ['expectedTo', hex(this.oldHead)], ['to', hex(this.headId)]])));
    return effects.sort((left, right) => left.slotClass - right.slotClass || compareBytes(left.slot, right.slot));
  }
}

export function proposalFor(commit: ModelCommit, bufferIdBytes: Uint8Array, basis: GraphState): Proposal {
  const proposal = new Proposal();
  const root = commit.root === null ? null : proposal.rope(commit.root);
  const edges: (readonly [EdgeKind, Uint8Array])[] = root === null ? [] : [['root', root]];
  edges.push(['anchor', commit.anchor]);
  proposal.headId = proposal.node('Head', commit.headFields, edges);
  proposal.bufferId = bufferIdBytes;
  proposal.oldBufferAtom = basis.node(bufferIdBytes)!.atom;
  proposal.bufferAtom = encodeFact(commit.bufferFields);
  proposal.oldHead = commit.basisHeadId;
  proposal.slotEdge = slotEdgeId(WARP_ID, bufferIdBytes, edgeTypeId('canonicalHead'));
  return proposal;
}
