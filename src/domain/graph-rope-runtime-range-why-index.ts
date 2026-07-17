import {
  ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  type RopeAdmittedFact,
} from './graph-rope-contract.js';
import type { GraphRopeRangeWhyFactCatalog } from './graph-rope-range-why-types.js';

const ZERO_VALUE = 0;

export interface GraphRopeRuntimeRangeWhyCatalog extends GraphRopeRangeWhyFactCatalog {
  indexFact(fact: RopeAdmittedFact): void;
}

export function createGraphRopeRuntimeRangeWhyCatalog(
  factsById: Map<string, RopeAdmittedFact>,
): GraphRopeRuntimeRangeWhyCatalog {
  const checkpointIdsByHeadId = new Map<string, string[]>();
  const anchorAssociationIdsByCheckpointId = new Map<string, string[]>();
  return {
    getFact: (id) => factsById.get(id) ?? null,
    checkpointIdsForHead: (headId, maxCount) => boundedFactIds(checkpointIdsByHeadId, headId, maxCount),
    anchorAssociationIdsForCheckpoint: (checkpointId, maxCount) => boundedFactIds(
      anchorAssociationIdsByCheckpointId,
      checkpointId,
      maxCount,
    ),
    indexFact(fact) {
      if (fact.kind === ROPE_CHECKPOINT_FACT_KIND) {
        appendFactIndex(checkpointIdsByHeadId, fact.headId, fact.checkpointId);
      }
      if (fact.kind === ROPE_CHECKPOINT_ANCHORED_FACT_KIND) {
        appendFactIndex(anchorAssociationIdsByCheckpointId, fact.checkpointId, fact.associationId);
      }
    },
  };
}

function appendFactIndex(index: Map<string, string[]>, key: string, factId: string): void {
  const existing = index.get(key) ?? [];
  if (!existing.includes(factId)) {
    index.set(key, [...existing, factId].sort());
  }
}

function boundedFactIds(
  index: Map<string, string[]>,
  key: string,
  maxCount: number,
): readonly string[] {
  return (index.get(key) ?? []).slice(ZERO_VALUE, Math.max(ZERO_VALUE, maxCount));
}
