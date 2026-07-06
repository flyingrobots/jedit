import {
  GRAPH_ROPE_SCHEMA_VERSION,
  ROPE_HEAD_FACT_KIND,
  type RopeHeadFact,
  type TextBlobFact,
  type TextBlobHashPort,
} from './graph-rope-contract.js';
import { buildTreeFromPieces, createLeafPieces, tickIdFor } from './graph-rope-runtime-tree-common.js';
import {
  RUNTIME_HASH_PREFIX_HEAD,
  RUNTIME_HASH_PREFIX_HEAD_ID,
  type GraphRopeTreeBuild,
  type NodeRef,
} from './graph-rope-runtime-tree-types.js';

export function createInitialTree(blob: TextBlobFact, bytes: Uint8Array, hash: TextBlobHashPort): GraphRopeTreeBuild {
  return buildTreeFromPieces(createLeafPieces(blob, bytes, hash), hash);
}

export function createInitialHead(worldlineId: string, root: NodeRef, hash: TextBlobHashPort): RopeHeadFact {
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_HEAD}${worldlineId}:${root.nodeId}:${root.byteLength}`);
  return {
    kind: ROPE_HEAD_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    headId: `${RUNTIME_HASH_PREFIX_HEAD_ID}${contentHash}`,
    worldlineId,
    rootNodeId: root.nodeId,
    createdByTickId: tickIdFor(worldlineId, contentHash, hash),
    byteLength: root.byteLength,
    lineCount: root.lineCount,
    contentHash,
  };
}
