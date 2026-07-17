import {
  BUFFER_WORLDLINE_FACT_KIND,
  ROPE_BRANCH_FACT_KIND,
  ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_DIFF_FACT_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND,
  TEXT_BLOB_FACT_KIND,
  type RopeAdmittedFact,
} from './graph-rope-types.js';

type RopeFactIdReader = (fact: RopeAdmittedFact) => string;

const ROPE_FACT_ID_READERS: ReadonlyMap<string, RopeFactIdReader> = new Map([
  [BUFFER_WORLDLINE_FACT_KIND, bufferWorldlineFactId],
  [ROPE_HEAD_FACT_KIND, ropeHeadFactId],
  [ROPE_BRANCH_FACT_KIND, ropeNodeFactId],
  [ROPE_LEAF_FACT_KIND, ropeNodeFactId],
  [TEXT_BLOB_FACT_KIND, textBlobFactId],
  [ROPE_REWRITE_FACT_KIND, ropeRewriteFactId],
  [ROPE_DIFF_FACT_KIND, ropeDiffFactId],
  [ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND, structuralMaintenanceFactId],
  [ROPE_CHECKPOINT_FACT_KIND, ropeCheckpointFactId],
  [ROPE_CHECKPOINT_ANCHORED_FACT_KIND, ropeCheckpointAnchoredFactId],
]);

export function ropeFactId(fact: RopeAdmittedFact): string {
  const reader = ROPE_FACT_ID_READERS.get(fact.kind);
  if (reader === undefined) {
    return '';
  }
  return reader(fact);
}

function bufferWorldlineFactId(fact: RopeAdmittedFact): string {
  return fact.kind === BUFFER_WORLDLINE_FACT_KIND ? fact.worldlineId : '';
}

function ropeHeadFactId(fact: RopeAdmittedFact): string {
  return fact.kind === ROPE_HEAD_FACT_KIND ? fact.headId : '';
}

function ropeNodeFactId(fact: RopeAdmittedFact): string {
  if (fact.kind === ROPE_BRANCH_FACT_KIND || fact.kind === ROPE_LEAF_FACT_KIND) {
    return fact.nodeId;
  }
  return '';
}

function textBlobFactId(fact: RopeAdmittedFact): string {
  return fact.kind === TEXT_BLOB_FACT_KIND ? fact.blobId : '';
}

function ropeRewriteFactId(fact: RopeAdmittedFact): string {
  return fact.kind === ROPE_REWRITE_FACT_KIND ? fact.rewriteId : '';
}

function ropeDiffFactId(fact: RopeAdmittedFact): string {
  return fact.kind === ROPE_DIFF_FACT_KIND ? fact.diffId : '';
}

function structuralMaintenanceFactId(fact: RopeAdmittedFact): string {
  return fact.kind === ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND ? fact.maintenanceId : '';
}

function ropeCheckpointFactId(fact: RopeAdmittedFact): string {
  return fact.kind === ROPE_CHECKPOINT_FACT_KIND ? fact.checkpointId : '';
}

function ropeCheckpointAnchoredFactId(fact: RopeAdmittedFact): string {
  return fact.kind === ROPE_CHECKPOINT_ANCHORED_FACT_KIND ? fact.associationId : '';
}
