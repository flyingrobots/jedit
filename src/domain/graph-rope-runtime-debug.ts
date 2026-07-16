import {
  ROPE_HEAD_FACT_KIND,
  type RopeHeadFact,
} from './graph-rope-contract.js';
import { GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD } from './graph-rope-runtime-issues.js';
import {
  debugTreeShape,
  type GraphRopeRuntimeFactReader,
  type RopeNodeFact,
  type TreeResult,
} from './graph-rope-runtime-tree.js';

export interface GraphRopeDebugShape {
  readonly headId: string;
  readonly rootNodeId: string;
  readonly byteLength: number;
  readonly nodeCount: number;
  readonly leafCount: number;
  readonly maxDepth: number;
  readonly retainedBlobBytes: number;
  readonly materializedProjectionBytes: number;
  readonly nodes: readonly GraphRopeDebugNode[];
}

export interface GraphRopeDebugNode {
  readonly nodeId: string;
  readonly kind: RopeNodeFact['kind'];
  readonly byteLength: number;
  readonly contentHash: string;
}

export function readGraphRopeDebugShape(
  reader: GraphRopeRuntimeFactReader,
  headId: string,
): TreeResult<GraphRopeDebugShape> {
  const head = headById(reader, headId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const shape = debugTreeShape(reader, head);
  return shape.ok
    ? { ok: true, value: { headId, rootNodeId: head.rootNodeId, byteLength: head.byteLength, ...shape.value } }
    : shape;
}

function headById(reader: GraphRopeRuntimeFactReader, headId: string): RopeHeadFact | null {
  const fact = reader.getFact(headId);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}
