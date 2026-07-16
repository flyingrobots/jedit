import { diffLines } from 'diff';
import {
  ROPE_DIFF_FACT_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  TICK_RECEIPT_FACT_KIND,
  type RopeDiffFact,
  type RopeHeadFact,
  type RopeRewriteFact,
  type TickReceiptFact,
} from './graph-rope-contract.js';
import { makeByteOffset, makeTextByteRange } from './graph-rope-coordinates.js';
import {
  deriveGraphRopeCausalLineDeletions,
  type CausalLineDeletionMarker,
} from './graph-rope-causal-line-deletions.js';
import {
  deriveCausalLineMarkers,
  type CausalLineMarker,
  type CausalLineMarkerTransition,
} from './graph-rope-causal-line-markers.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_BASIS_NOT_ANCESTOR,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD,
  type GraphRopeRuntimeObstructionCode,
} from './graph-rope-runtime-issues.js';
import { readTreeWindow, type GraphRopeRuntimeFactReader } from './graph-rope-runtime-tree.js';

export const GRAPH_ROPE_CAUSAL_LINE_DIFF_OBSERVER_VERSION = 'jedit-causal-line-diff-v3';

export interface GraphRopeCausalLineDiffInput {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly maxByteCount: number;
  readonly maxLineCount: number;
  readonly maxRewriteCount: number;
  readonly maxMarkerCount: number;
}

export interface GraphRopeCausalLineDiffReading {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly insertedLineCount: number;
  readonly deletedLineCount: number;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly markers: readonly CausalLineMarker[];
  readonly deletions: readonly CausalLineDeletionMarker[];
  readonly observerVersion: typeof GRAPH_ROPE_CAUSAL_LINE_DIFF_OBSERVER_VERSION;
}

export type GraphRopeCausalLineDiffResult =
  | { readonly ok: true; readonly value: GraphRopeCausalLineDiffReading }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

interface CausalLineDiffSupport {
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly transitions: readonly CausalLineMarkerTransition[];
}

interface CausalLineDiffEvidence {
  readonly markers: readonly CausalLineMarker[];
  readonly deletions: readonly CausalLineDeletionMarker[];
}

interface CausalLineDiffStep {
  readonly parentHead: RopeHeadFact;
  readonly transition: CausalLineMarkerTransition;
}

interface CausalTransitionEvidence {
  readonly receipt: TickReceiptFact;
  readonly rewrite: RopeRewriteFact;
  readonly diff: RopeDiffFact;
}

type CausalLineDiffSupportResult =
  | { readonly ok: true; readonly value: CausalLineDiffSupport }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

type CausalLineDiffStepResult =
  | { readonly ok: true; readonly value: CausalLineDiffStep }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

type CausalTransitionEvidenceResult =
  | { readonly ok: true; readonly value: CausalTransitionEvidence }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

type TextReadingResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

type CausalLineDiffHeadsResult =
  | { readonly ok: true; readonly basisHead: RopeHeadFact; readonly nextHead: RopeHeadFact }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

type CausalLineDiffTextsResult =
  | { readonly ok: true; readonly basisText: string; readonly nextText: string }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

export function readGraphRopeCausalLineDiff(
  facts: GraphRopeRuntimeFactReader,
  input: GraphRopeCausalLineDiffInput,
): GraphRopeCausalLineDiffResult {
  const heads = causalLineDiffHeads(facts, input);
  if (!heads.ok) {
    return heads;
  }
  const support = collectCausalSupport(
    facts,
    heads.basisHead,
    heads.nextHead,
    input.maxRewriteCount,
  );
  if (!support.ok) {
    return support;
  }
  const texts = causalLineDiffTexts(facts, heads);
  if (!texts.ok) {
    return texts;
  }
  return causalLineDiffReading(facts, input, heads, support.value, texts);
}

function causalLineDiffReading(
  facts: GraphRopeRuntimeFactReader,
  input: GraphRopeCausalLineDiffInput,
  heads: Extract<CausalLineDiffHeadsResult, { readonly ok: true }>,
  support: CausalLineDiffSupport,
  texts: Extract<CausalLineDiffTextsResult, { readonly ok: true }>,
): GraphRopeCausalLineDiffResult {
  const counts = countChangedLines(texts.basisText, texts.nextText);
  const markers = deriveCausalLineMarkers({
    basisText: texts.basisText,
    nextText: texts.nextText,
    transitions: support.transitions,
    maxMarkerCount: input.maxMarkerCount,
  });
  if (!markers.ok) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED };
  }
  const deletions = deriveGraphRopeCausalLineDeletions(facts, {
    nextText: texts.nextText,
    transitions: support.transitions,
    maxHistoricalByteCount: input.maxByteCount,
    maxDeletionCount: input.maxMarkerCount - markers.markers.length,
  });
  return deletions.ok
    ? causalLineDiffValue(input, heads, support, counts, {
        markers: markers.markers,
        deletions: deletions.deletions,
      })
    : deletions;
}

function causalLineDiffValue(
  input: GraphRopeCausalLineDiffInput,
  heads: Extract<CausalLineDiffHeadsResult, { readonly ok: true }>,
  support: CausalLineDiffSupport,
  counts: { readonly inserted: number; readonly deleted: number },
  evidence: CausalLineDiffEvidence,
): GraphRopeCausalLineDiffResult {
  return {
    ok: true,
    value: {
      worldlineId: input.worldlineId,
      basisHeadId: heads.basisHead.headId,
      nextHeadId: heads.nextHead.headId,
      insertedLineCount: counts.inserted,
      deletedLineCount: counts.deleted,
      rewriteIds: support.rewriteIds,
      diffIds: support.diffIds,
      markers: evidence.markers,
      deletions: evidence.deletions,
      observerVersion: GRAPH_ROPE_CAUSAL_LINE_DIFF_OBSERVER_VERSION,
    },
  };
}

function causalLineDiffHeads(
  facts: GraphRopeRuntimeFactReader,
  input: GraphRopeCausalLineDiffInput,
): CausalLineDiffHeadsResult {
  if (!validInputLimits(input)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  const basisHead = headById(facts, input.basisHeadId);
  const nextHead = headById(facts, input.nextHeadId);
  if (basisHead === null || nextHead === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  if (basisHead.worldlineId !== input.worldlineId || nextHead.worldlineId !== input.worldlineId) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_BASIS_NOT_ANCESTOR };
  }
  return exceedsLimit(basisHead, input) || exceedsLimit(nextHead, input)
    ? { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED }
    : { ok: true, basisHead, nextHead };
}

function validInputLimits(input: GraphRopeCausalLineDiffInput): boolean {
  return validLimit(input.maxByteCount)
    && validLimit(input.maxLineCount)
    && validLimit(input.maxRewriteCount)
    && validLimit(input.maxMarkerCount);
}

function causalLineDiffTexts(
  facts: GraphRopeRuntimeFactReader,
  heads: Extract<CausalLineDiffHeadsResult, { readonly ok: true }>,
): CausalLineDiffTextsResult {
  const basis = readHeadText(facts, heads.basisHead);
  if (!basis.ok) {
    return basis;
  }
  const next = readHeadText(facts, heads.nextHead);
  return next.ok
    ? { ok: true, basisText: basis.text, nextText: next.text }
    : next;
}

function collectCausalSupport(
  facts: GraphRopeRuntimeFactReader,
  basisHead: RopeHeadFact,
  nextHead: RopeHeadFact,
  maxRewriteCount: number,
): CausalLineDiffSupportResult {
  const transitions: CausalLineMarkerTransition[] = [];
  const visitedHeadIds = new Set<string>();
  let currentHead = nextHead;
  while (currentHead.headId !== basisHead.headId) {
    if (transitions.length >= maxRewriteCount) {
      return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED };
    }
    const step = causalSupportStep(facts, currentHead, visitedHeadIds);
    if (!step.ok) {
      return step;
    }
    visitedHeadIds.add(currentHead.headId);
    transitions.push(step.value.transition);
    currentHead = step.value.parentHead;
  }
  transitions.reverse();
  return {
    ok: true,
    value: {
      rewriteIds: transitions.map(({ rewrite }) => rewrite.rewriteId),
      diffIds: transitions.map(({ diff }) => diff.diffId),
      transitions,
    },
  };
}

function causalSupportStep(
  facts: GraphRopeRuntimeFactReader,
  currentHead: RopeHeadFact,
  visitedHeadIds: ReadonlySet<string>,
): CausalLineDiffStepResult {
  if (visitedHeadIds.has(currentHead.headId)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  const basisHeadId = currentHead.basisHeadId;
  if (basisHeadId === undefined) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_BASIS_NOT_ANCESTOR };
  }
  const evidence = causalTransitionEvidence(facts, currentHead);
  if (!evidence.ok) {
    return evidence;
  }
  const parentHead = headById(facts, basisHeadId);
  return parentHead === null
    ? { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE }
    : {
        ok: true,
        value: {
          parentHead,
          transition: { rewrite: evidence.value.rewrite, diff: evidence.value.diff },
        },
      };
}

function causalTransitionEvidence(
  facts: GraphRopeRuntimeFactReader,
  currentHead: RopeHeadFact,
): CausalTransitionEvidenceResult {
  const receipt = receiptById(facts, currentHead.createdByTickId);
  if (receipt === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  const rewrite = rewriteById(facts, receipt.rewriteId);
  if (rewrite === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  const diff = diffById(facts, rewrite.diffId);
  if (diff === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  return validTransition(currentHead, receipt, rewrite, diff)
    ? { ok: true, value: { receipt, rewrite, diff } }
    : { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
}

function validTransition(
  nextHead: RopeHeadFact,
  receipt: TickReceiptFact,
  rewrite: RopeRewriteFact,
  diff: RopeDiffFact,
): boolean {
  const basisHeadId = nextHead.basisHeadId;
  return basisHeadId !== undefined
    && receiptMatchesHead(nextHead, receipt, basisHeadId)
    && rewriteMatchesReceipt(rewrite, receipt, basisHeadId)
    && diffMatchesRewrite(diff, rewrite, basisHeadId, nextHead.headId);
}

function receiptMatchesHead(nextHead: RopeHeadFact, receipt: TickReceiptFact, basisHeadId: string): boolean {
  return receipt.tickId === nextHead.createdByTickId
    && receipt.worldlineId === nextHead.worldlineId
    && receipt.basisHeadId === basisHeadId
    && receipt.nextHeadId === nextHead.headId;
}

function rewriteMatchesReceipt(rewrite: RopeRewriteFact, receipt: TickReceiptFact, basisHeadId: string): boolean {
  return rewrite.admittedByTickId === receipt.tickId
    && rewrite.worldlineId === receipt.worldlineId
    && rewrite.basisHeadId === basisHeadId
    && rewrite.nextHeadId === receipt.nextHeadId;
}

function diffMatchesRewrite(diff: RopeDiffFact, rewrite: RopeRewriteFact, basisHeadId: string, nextHeadId: string): boolean {
  return diff.rewriteId === rewrite.rewriteId
    && diff.basisHeadId === basisHeadId
    && diff.nextHeadId === nextHeadId;
}

function readHeadText(facts: GraphRopeRuntimeFactReader, head: RopeHeadFact): TextReadingResult {
  const startByte = makeByteOffset(0);
  const endByte = makeByteOffset(head.byteLength);
  if (!startByte.ok || !endByte.ok) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  const byteRange = makeTextByteRange(startByte.value, endByte.value);
  if (!byteRange.ok) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  const reading = readTreeWindow(facts, head, byteRange.value);
  return reading.ok ? { ok: true, text: reading.value.text } : reading;
}

function countChangedLines(basisText: string, nextText: string): { readonly inserted: number; readonly deleted: number } {
  let inserted = 0;
  let deleted = 0;
  for (const change of diffLines(basisText, nextText)) {
    if (change.added) {
      inserted += change.count;
    } else if (change.removed) {
      deleted += change.count;
    }
  }
  return { inserted, deleted };
}

function validLimit(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function exceedsLimit(head: RopeHeadFact, input: GraphRopeCausalLineDiffInput): boolean {
  return head.byteLength > input.maxByteCount || head.lineCount > input.maxLineCount;
}

function headById(facts: GraphRopeRuntimeFactReader, headId: string): RopeHeadFact | null {
  const fact = facts.getFact(headId);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}

function receiptById(facts: GraphRopeRuntimeFactReader, tickId: string): TickReceiptFact | null {
  const fact = facts.getFact(tickId);
  return fact?.kind === TICK_RECEIPT_FACT_KIND ? fact : null;
}

function rewriteById(facts: GraphRopeRuntimeFactReader, rewriteId: string): RopeRewriteFact | null {
  const fact = facts.getFact(rewriteId);
  return fact?.kind === ROPE_REWRITE_FACT_KIND ? fact : null;
}

function diffById(facts: GraphRopeRuntimeFactReader, diffId: string): RopeDiffFact | null {
  const fact = facts.getFact(diffId);
  return fact?.kind === ROPE_DIFF_FACT_KIND ? fact : null;
}
