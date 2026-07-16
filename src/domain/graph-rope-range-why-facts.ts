import {
  BUFFER_WORLDLINE_FACT_KIND,
  ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_DIFF_FACT_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  TICK_RECEIPT_FACT_KIND,
  type BufferWorldlineFact,
  type RopeCheckpointAnchoredFact,
  type RopeCheckpointFact,
  type RopeDiffFact,
  type RopeHeadFact,
  type RopeRewriteFact,
  type TickReceiptFact,
} from './graph-rope-contract.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE,
} from './graph-rope-runtime-issues.js';
import type { GraphRopeRangeWhyFactCatalog } from './graph-rope-range-why-types.js';
import type { TreeResult } from './graph-rope-runtime-tree.js';

export interface GraphRopeRangeWhyTransitionFacts {
  readonly basisHead: RopeHeadFact;
  readonly receipt: TickReceiptFact;
  readonly rewrite: RopeRewriteFact;
  readonly diff: RopeDiffFact;
}

export function readRangeWhyTransition(
  catalog: GraphRopeRangeWhyFactCatalog,
  head: RopeHeadFact,
): TreeResult<GraphRopeRangeWhyTransitionFacts> {
  const receipt = receiptById(catalog, head.createdByTickId);
  if (receipt === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  const rewrite = rewriteById(catalog, receipt.rewriteId);
  if (rewrite === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  const diff = diffById(catalog, rewrite.diffId);
  if (diff === null || head.basisHeadId == null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  const basisHead = rangeWhyHeadById(catalog, head.basisHeadId);
  if (basisHead === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  return transitionMatches(head, basisHead, receipt, rewrite, diff)
    ? { ok: true, value: { basisHead, receipt, rewrite, diff } }
    : { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
}

export function rangeWhyWorldlineById(
  catalog: GraphRopeRangeWhyFactCatalog,
  id: string,
): BufferWorldlineFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === BUFFER_WORLDLINE_FACT_KIND ? fact : null;
}

export function rangeWhyHeadById(catalog: GraphRopeRangeWhyFactCatalog, id: string): RopeHeadFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}

export function rangeWhyCheckpointById(
  catalog: GraphRopeRangeWhyFactCatalog,
  id: string,
): RopeCheckpointFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === ROPE_CHECKPOINT_FACT_KIND ? fact : null;
}

export function rangeWhyAnchorAssociationById(
  catalog: GraphRopeRangeWhyFactCatalog,
  id: string,
): RopeCheckpointAnchoredFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === ROPE_CHECKPOINT_ANCHORED_FACT_KIND ? fact : null;
}

function receiptById(catalog: GraphRopeRangeWhyFactCatalog, id: string): TickReceiptFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === TICK_RECEIPT_FACT_KIND ? fact : null;
}

function rewriteById(catalog: GraphRopeRangeWhyFactCatalog, id: string): RopeRewriteFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === ROPE_REWRITE_FACT_KIND ? fact : null;
}

function diffById(catalog: GraphRopeRangeWhyFactCatalog, id: string): RopeDiffFact | null {
  const fact = catalog.getFact(id);
  return fact?.kind === ROPE_DIFF_FACT_KIND ? fact : null;
}

function transitionMatches(
  head: RopeHeadFact,
  basis: RopeHeadFact,
  receipt: TickReceiptFact,
  rewrite: RopeRewriteFact,
  diff: RopeDiffFact,
): boolean {
  return receiptMatchesTransition(receipt, head, basis)
    && rewriteMatchesTransition(rewrite, receipt, head, basis)
    && diffMatchesTransition(diff, rewrite, head, basis);
}

function receiptMatchesTransition(receipt: TickReceiptFact, head: RopeHeadFact, basis: RopeHeadFact): boolean {
  return receipt.nextHeadId === head.headId && receipt.basisHeadId === basis.headId;
}

function rewriteMatchesTransition(
  rewrite: RopeRewriteFact,
  receipt: TickReceiptFact,
  head: RopeHeadFact,
  basis: RopeHeadFact,
): boolean {
  return receipt.rewriteId === rewrite.rewriteId
    && rewrite.nextHeadId === head.headId
    && rewrite.basisHeadId === basis.headId
    && rewrite.admittedByTickId === receipt.tickId;
}

function diffMatchesTransition(
  diff: RopeDiffFact,
  rewrite: RopeRewriteFact,
  head: RopeHeadFact,
  basis: RopeHeadFact,
): boolean {
  return rewrite.diffId === diff.diffId
    && diff.rewriteId === rewrite.rewriteId
    && diff.nextHeadId === head.headId
    && diff.basisHeadId === basis.headId;
}
