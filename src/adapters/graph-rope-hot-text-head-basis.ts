import type { RopeHeadFact } from '../domain/graph-rope-contract.js';
import type { HotTextHeadBasis } from '../ports/hot-text-runtime.js';

export function toHotTextHeadBasis(head: RopeHeadFact): HotTextHeadBasis {
  return {
    worldlineId: head.worldlineId,
    headId: head.headId,
    rootNodeId: head.rootNodeId,
    byteLength: head.byteLength,
    lineCount: head.lineCount,
  };
}
