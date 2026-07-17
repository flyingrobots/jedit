import {
  BYTE_OFFSET_COORDINATE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_DIFF_SPAN_INSERT_KIND,
  type BufferWorldlineFact,
  type RopeCheckpointAnchoredFact,
  type RopeCheckpointFact,
  type RopeDiffSpan,
  type RopeHeadFact,
  type TextByteRange,
} from './graph-rope-contract.js';
import {
  rangeWhyAnchorAssociationById,
  rangeWhyCheckpointById,
  rangeWhyHeadById,
  rangeWhyWorldlineById,
  readRangeWhyTransition,
  type GraphRopeRangeWhyTransitionFacts,
} from './graph-rope-range-why-facts.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_RANGE_WHY_LIMIT_EXCEEDED,
} from './graph-rope-runtime-issues.js';
import {
  readTreeWindow,
  type GraphRopeTreeWindowEvidence,
  type TreeResult,
} from './graph-rope-runtime-tree.js';
import {
  GRAPH_ROPE_RANGE_WHY_COVERAGE_COMPLETE,
  GRAPH_ROPE_RANGE_WHY_OBSERVER_VERSION,
  GRAPH_ROPE_RANGE_WHY_ORIGIN_IMPORTED,
  GRAPH_ROPE_RANGE_WHY_ORIGIN_REWRITE,
  type GraphRopeRangeWhyCheckpointEvidence,
  type GraphRopeRangeWhyFactCatalog,
  type GraphRopeRangeWhyFragment,
  type GraphRopeRangeWhyInput,
  type GraphRopeRangeWhyOrigin,
  type GraphRopeRangeWhyReading,
} from './graph-rope-range-why-types.js';

const ZERO_VALUE = 0;
const NEXT_DEPTH = 1;

interface EvidenceBudget {
  readonly maxFacts: number;
  readonly factIds: Set<string>;
  exceeded: boolean;
}

interface WhyRangeContext {
  readonly catalog: GraphRopeRangeWhyFactCatalog;
  readonly worldline: BufferWorldlineFact;
  readonly budget: EvidenceBudget;
  readonly maxDepth: number;
}

interface WalkSegment {
  readonly currentRange: TextByteRange;
  readonly walkRange: TextByteRange;
}

interface OriginPiece {
  readonly currentRange: TextByteRange;
  readonly origin: GraphRopeRangeWhyOrigin;
}

export function readGraphRopeRangeWhy(
  catalog: GraphRopeRangeWhyFactCatalog,
  input: GraphRopeRangeWhyInput,
): TreeResult<GraphRopeRangeWhyReading> {
  if (!validWhyLimits(input)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE };
  }
  const budget = createEvidenceBudget(input.maxFacts);
  const boundedCatalog = catalogWithEvidenceBudget(catalog, budget);
  const basis = rangeWhyBasis(boundedCatalog, input);
  if (!basis.ok) {
    return budgetAwareResult(budget, basis);
  }
  const window = readTreeWindow(boundedCatalog, basis.value.head, input.queriedRange);
  if (!window.ok) {
    return budgetAwareResult(budget, window);
  }
  const context = whyRangeContext(boundedCatalog, basis.value.worldline, budget, input.maxDepth);
  const fragments = fragmentsForWindow(context, basis.value.head, window.value.validationEvidence);
  if (!fragments.ok) {
    return budgetAwareResult(budget, fragments);
  }
  const checkpoints = relatedCheckpoints(context, input.basisHeadId);
  const result = checkpoints.ok
    ? completeReading(input, context, fragments.value, checkpoints.value)
    : checkpoints;
  return budgetAwareResult(budget, result);
}

function rangeWhyBasis(
  catalog: GraphRopeRangeWhyFactCatalog,
  input: GraphRopeRangeWhyInput,
): TreeResult<{ readonly worldline: BufferWorldlineFact; readonly head: RopeHeadFact }> {
  const worldline = rangeWhyWorldlineById(catalog, input.worldlineId);
  const head = rangeWhyHeadById(catalog, input.basisHeadId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  if (worldline === null || head.worldlineId !== input.worldlineId) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  return validWhyInput(input, head.byteLength)
    ? { ok: true, value: { worldline, head } }
    : { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE };
}

function validWhyInput(input: GraphRopeRangeWhyInput, byteLength: number): boolean {
  return input.queriedRange.startByte.value < input.queriedRange.endByte.value
    && input.queriedRange.endByte.value <= byteLength;
}

function validWhyLimits(input: GraphRopeRangeWhyInput): boolean {
  return input.maxFacts > ZERO_VALUE
    && input.maxDepth > ZERO_VALUE
    && input.maxHistoricalTextBytes >= ZERO_VALUE;
}

function whyRangeContext(
  catalog: GraphRopeRangeWhyFactCatalog,
  worldline: BufferWorldlineFact,
  budget: EvidenceBudget,
  maxDepth: number,
): WhyRangeContext {
  return {
    catalog,
    worldline,
    budget,
    maxDepth,
  };
}

function fragmentsForWindow(
  context: WhyRangeContext,
  head: RopeHeadFact,
  evidence: readonly GraphRopeTreeWindowEvidence[],
): TreeResult<readonly GraphRopeRangeWhyFragment[]> {
  const fragments: GraphRopeRangeWhyFragment[] = [];
  for (const support of evidence) {
    const origins = resolveOrigins(context, head, sameRangeSegment(support.byteRange), ZERO_VALUE);
    if (!origins.ok) {
      return origins;
    }
    fragments.push(...origins.value.map(piece => fragmentFromPiece(head, support, piece)));
  }
  return { ok: true, value: fragments };
}

function resolveOrigins(
  context: WhyRangeContext,
  head: RopeHeadFact,
  segment: WalkSegment,
  depth: number,
): TreeResult<readonly OriginPiece[]> {
  if (depth >= context.maxDepth) {
    return limitExceeded();
  }
  if (head.basisHeadId == null) {
    return initialOrigin(context, head, segment.currentRange);
  }
  const transition = transitionForHead(context, head);
  return transition.ok
    ? originsThroughTransition(context, transition.value, segment, depth)
    : transition;
}

function initialOrigin(
  context: WhyRangeContext,
  head: RopeHeadFact,
  currentRange: TextByteRange,
): TreeResult<readonly OriginPiece[]> {
  if (context.worldline.initialHeadId !== head.headId) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  return {
    ok: true,
    value: [{
      currentRange,
      origin: {
        kind: GRAPH_ROPE_RANGE_WHY_ORIGIN_IMPORTED,
        worldlineId: context.worldline.worldlineId,
        initialHeadId: head.headId,
        createdAtTickId: context.worldline.createdAtTick,
      },
    }],
  };
}

function transitionForHead(
  context: WhyRangeContext,
  head: RopeHeadFact,
): TreeResult<GraphRopeRangeWhyTransitionFacts> {
  const transition = readRangeWhyTransition(context.catalog, head);
  if (!transition.ok) {
    return transition;
  }
  return transition;
}

function originsThroughTransition(
  context: WhyRangeContext,
  transition: GraphRopeRangeWhyTransitionFacts,
  segment: WalkSegment,
  depth: number,
): TreeResult<readonly OriginPiece[]> {
  const output: OriginPiece[] = [];
  let coveredBytes = ZERO_VALUE;
  for (const span of transition.diff.spans) {
    const overlap = overlapWithNextRange(segment.walkRange, span);
    if (overlap === null) {
      continue;
    }
    const currentRange = currentSubrange(segment, overlap);
    const pieces = originPiecesForSpan(context, transition, span, { currentRange, walkRange: overlap }, depth);
    if (!pieces.ok) {
      return pieces;
    }
    output.push(...pieces.value);
    coveredBytes += rangeLength(overlap);
  }
  return coveredBytes === rangeLength(segment.walkRange)
    ? { ok: true, value: output }
    : { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
}

function originPiecesForSpan(
  context: WhyRangeContext,
  transition: GraphRopeRangeWhyTransitionFacts,
  span: RopeDiffSpan,
  segment: WalkSegment,
  depth: number,
): TreeResult<readonly OriginPiece[]> {
  if (span.kind === ROPE_DIFF_SPAN_INSERT_KIND) {
    return { ok: true, value: [{ currentRange: segment.currentRange, origin: rewriteOrigin(transition) }] };
  }
  if (span.kind !== ROPE_DIFF_SPAN_EQUAL_KIND) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  return resolveOrigins(
    context,
    transition.basisHead,
    { currentRange: segment.currentRange, walkRange: mapEqualRange(span, segment.walkRange) },
    depth + NEXT_DEPTH,
  );
}

function rewriteOrigin(transition: GraphRopeRangeWhyTransitionFacts): GraphRopeRangeWhyOrigin {
  return {
    kind: GRAPH_ROPE_RANGE_WHY_ORIGIN_REWRITE,
    rewriteId: transition.rewrite.rewriteId,
    diffId: transition.diff.diffId,
    textTickReceiptId: transition.receipt.tickId,
    basisHeadId: transition.basisHead.headId,
    nextHeadId: transition.receipt.nextHeadId,
  };
}

function relatedCheckpoints(
  context: WhyRangeContext,
  headId: string,
): TreeResult<readonly GraphRopeRangeWhyCheckpointEvidence[]> {
  const output: GraphRopeRangeWhyCheckpointEvidence[] = [];
  const overflowCount = remainingFactCapacity(context.budget) + NEXT_DEPTH;
  const checkpointIds = context.catalog.checkpointIdsForHead(headId, overflowCount);
  if (checkpointIds.length >= overflowCount) {
    return limitExceeded();
  }
  for (const checkpointId of checkpointIds) {
    const checkpoint = rangeWhyCheckpointById(context.catalog, checkpointId);
    if (checkpoint === null) {
      return missingEvidence();
    }
    const associated = checkpointEvidence(context, checkpoint);
    if (!associated.ok) {
      return associated;
    }
    output.push(associated.value);
  }
  return { ok: true, value: output };
}

function checkpointEvidence(
  context: WhyRangeContext,
  checkpoint: RopeCheckpointFact,
): TreeResult<GraphRopeRangeWhyCheckpointEvidence> {
  const associationIds = context.catalog.anchorAssociationIdsForCheckpoint(
    checkpoint.checkpointId,
    NEXT_DEPTH,
  );
  if (associationIds.length === ZERO_VALUE) {
    return { ok: true, value: checkpointWithoutAnchor(checkpoint) };
  }
  const association = rangeWhyAnchorAssociationById(context.catalog, associationIds[ZERO_VALUE] ?? '');
  if (association === null) {
    return missingEvidence();
  }
  return { ok: true, value: checkpointWithAnchor(checkpoint, association) };
}

function checkpointWithoutAnchor(checkpoint: RopeCheckpointFact): GraphRopeRangeWhyCheckpointEvidence {
  return { checkpointId: checkpoint.checkpointId, headId: checkpoint.headId, reason: checkpoint.reason };
}

function checkpointWithAnchor(
  checkpoint: RopeCheckpointFact,
  association: RopeCheckpointAnchoredFact,
): GraphRopeRangeWhyCheckpointEvidence {
  return {
    ...checkpointWithoutAnchor(checkpoint),
    anchorAssociation: {
      associationId: association.associationId,
      causalAnchorId: association.causalAnchorId,
      causalAnchorFactId: association.causalAnchorFactId,
      causalAnchorReceiptId: association.causalAnchorReceiptId,
    },
  };
}

function completeReading(
  input: GraphRopeRangeWhyInput,
  context: WhyRangeContext,
  fragments: readonly GraphRopeRangeWhyFragment[],
  related: readonly GraphRopeRangeWhyCheckpointEvidence[],
): TreeResult<GraphRopeRangeWhyReading> {
  return {
    ok: true,
    value: {
      worldlineId: input.worldlineId,
      basisHeadId: input.basisHeadId,
      queriedRange: input.queriedRange,
      coverage: { kind: GRAPH_ROPE_RANGE_WHY_COVERAGE_COMPLETE, coveredRange: input.queriedRange },
      fragments,
      relatedCheckpoints: related,
      inspectedFactCount: context.budget.factIds.size,
      observerVersion: GRAPH_ROPE_RANGE_WHY_OBSERVER_VERSION,
    },
  };
}

function fragmentFromPiece(
  head: RopeHeadFact,
  support: GraphRopeTreeWindowEvidence,
  piece: OriginPiece,
): GraphRopeRangeWhyFragment {
  return {
    coveredRange: piece.currentRange,
    headId: head.headId,
    leafId: support.leafId,
    blobId: support.blobId,
    origin: piece.origin,
  };
}

function overlapWithNextRange(range: TextByteRange, span: RopeDiffSpan): TextByteRange | null {
  const nextRange = nextRangeForSpan(span);
  if (nextRange === null) {
    return null;
  }
  const start = Math.max(range.startByte.value, nextRange.startByte.value);
  const end = Math.min(range.endByte.value, nextRange.endByte.value);
  return start < end ? numericRange(start, end) : null;
}

function nextRangeForSpan(span: RopeDiffSpan): TextByteRange | null {
  return span.kind === ROPE_DIFF_SPAN_EQUAL_KIND || span.kind === ROPE_DIFF_SPAN_INSERT_KIND
    ? span.nextRange
    : null;
}

function currentSubrange(segment: WalkSegment, overlap: TextByteRange): TextByteRange {
  const startOffset = overlap.startByte.value - segment.walkRange.startByte.value;
  const start = segment.currentRange.startByte.value + startOffset;
  return numericRange(start, start + rangeLength(overlap));
}

function mapEqualRange(
  span: Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_EQUAL_KIND }>,
  range: TextByteRange,
): TextByteRange {
  const startOffset = range.startByte.value - span.nextRange.startByte.value;
  const start = span.basisRange.startByte.value + startOffset;
  return numericRange(start, start + rangeLength(range));
}

function sameRangeSegment(range: TextByteRange): WalkSegment {
  return { currentRange: range, walkRange: range };
}

function numericRange(startByte: number, endByte: number): TextByteRange {
  return {
    startByte: { kind: BYTE_OFFSET_COORDINATE_KIND, value: startByte },
    endByte: { kind: BYTE_OFFSET_COORDINATE_KIND, value: endByte },
  };
}

function rangeLength(range: TextByteRange): number {
  return range.endByte.value - range.startByte.value;
}

function createEvidenceBudget(maxFacts: number): EvidenceBudget {
  return { maxFacts, factIds: new Set<string>(), exceeded: false };
}

function catalogWithEvidenceBudget(
  catalog: GraphRopeRangeWhyFactCatalog,
  budget: EvidenceBudget,
): GraphRopeRangeWhyFactCatalog {
  return {
    getFact(id) {
      if (!budget.factIds.has(id)) {
        if (budget.factIds.size >= budget.maxFacts) {
          budget.exceeded = true;
          return null;
        }
        budget.factIds.add(id);
      }
      return catalog.getFact(id);
    },
    checkpointIdsForHead: (headId, maxCount) => catalog.checkpointIdsForHead(headId, maxCount),
    anchorAssociationIdsForCheckpoint: (checkpointId, maxCount) => (
      catalog.anchorAssociationIdsForCheckpoint(checkpointId, maxCount)
    ),
  };
}

function remainingFactCapacity(budget: EvidenceBudget): number {
  return budget.maxFacts - budget.factIds.size;
}

function budgetAwareResult<TValue>(
  budget: EvidenceBudget,
  result: TreeResult<TValue>,
): TreeResult<TValue> {
  if (budget.exceeded) {
    return limitExceeded();
  }
  return result;
}

function limitExceeded<TValue>(): TreeResult<TValue> {
  return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_RANGE_WHY_LIMIT_EXCEEDED };
}

function missingEvidence<TValue>(): TreeResult<TValue> {
  return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
}
