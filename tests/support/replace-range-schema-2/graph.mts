// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// A fixture graph in Echo's slot model (node record, alpha atom, outgoing
// edges by type) and a view that records exactly the slots a reader resolves,
// as Echo's witnessed reads do (authored-operation-effects.md, Witnessed reads).
import { hex } from './content-address-v1.mts';

export class NodeRecord {
  readonly id: Uint8Array;
  readonly nodeType: Uint8Array;
  readonly atomType: Uint8Array;
  readonly atom: Uint8Array;
  constructor(id: Uint8Array, nodeType: Uint8Array, atomType: Uint8Array, atom: Uint8Array) {
    this.id = id;
    this.nodeType = nodeType;
    this.atomType = atomType;
    this.atom = atom;
  }
}

export class EdgeRecord {
  readonly id: Uint8Array;
  readonly from: Uint8Array;
  readonly edgeType: Uint8Array;
  readonly to: Uint8Array;
  constructor(id: Uint8Array, from: Uint8Array, edgeType: Uint8Array, to: Uint8Array) {
    this.id = id;
    this.from = from;
    this.edgeType = edgeType;
    this.to = to;
  }
}

export class GraphState {
  readonly nodes = new Map<string, NodeRecord>();
  readonly edges = new Map<string, EdgeRecord>();

  putNode(record: NodeRecord): void {
    this.nodes.set(hex(record.id), record);
  }

  putEdge(record: EdgeRecord): void {
    this.edges.set(hex(record.id), record);
  }

  node(id: Uint8Array): NodeRecord | undefined {
    return this.nodes.get(hex(id));
  }

  outgoing(from: Uint8Array, edgeType: Uint8Array): EdgeRecord[] {
    const source = hex(from);
    const type = hex(edgeType);
    return [...this.edges.values()]
      .filter((edge) => hex(edge.from) === source && hex(edge.edgeType) === type)
      .sort((left, right) => hex(left.id).localeCompare(hex(right.id)));
  }

  allOutgoing(from: Uint8Array): EdgeRecord[] {
    const source = hex(from);
    return [...this.edges.values()].filter((edge) => hex(edge.from) === source);
  }
}

/** A resolved read range: the source node and the edge type. */
export class RangeRead {
  readonly from: string;
  readonly edgeType: string;
  constructor(from: string, edgeType: string) {
    this.from = from;
    this.edgeType = edgeType;
  }
}

export class RecordingView {
  readonly graph: GraphState;
  readonly nodeReads = new Set<string>();
  readonly rangeReads = new Map<string, RangeRead>();

  constructor(graph: GraphState) {
    this.graph = graph;
  }

  /** Resolves a node record and its atom; an absent node is a read too. */
  node(id: Uint8Array): NodeRecord | undefined {
    this.nodeReads.add(hex(id));
    return this.graph.node(id);
  }

  edges(from: Uint8Array, edgeType: Uint8Array): EdgeRecord[] {
    const range = new RangeRead(hex(from), hex(edgeType));
    this.rangeReads.set(`${range.from}/${range.edgeType}`, range);
    return this.graph.outgoing(from, edgeType);
  }
}
