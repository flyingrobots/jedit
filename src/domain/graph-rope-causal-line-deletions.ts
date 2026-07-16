import {
  ROPE_DIFF_SPAN_INSERT_KIND,
  ROPE_HEAD_FACT_KIND,
  type RopeDiffFact,
  type RopeHeadFact,
  type RopeRewriteFact,
} from './graph-rope-contract.js';
import type { CausalLineMarkerTransition } from './graph-rope-causal-line-markers.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE,
  type GraphRopeRuntimeObstructionCode,
} from './graph-rope-runtime-issues.js';
import { readTreeWindow, type GraphRopeRuntimeFactReader } from './graph-rope-runtime-tree.js';
import { readTreeByteWindow } from './graph-rope-runtime-tree-read.js';
import { textByteRange } from './graph-rope-runtime-tree-common.js';

const ZERO_VALUE = 0;
const CARRIAGE_RETURN_BYTE = 0x0d;
const LINE_FEED_BYTE = 0x0a;
const UTF8_ENCODER = new TextEncoder();

export interface CausalLineDeletionMarker {
  readonly boundaryLineNumber: number;
  readonly deletedLineCount: number;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface GraphRopeCausalLineDeletionInput {
  readonly nextText: string;
  readonly transitions: readonly CausalLineMarkerTransition[];
  readonly maxHistoricalByteCount: number;
  readonly maxDeletionCount: number;
}

export type GraphRopeCausalLineDeletionResult =
  | { readonly ok: true; readonly deletions: readonly CausalLineDeletionMarker[] }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

interface ProjectedDeletion {
  readonly byteOffset: number;
  readonly deletedLineCount: number;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

interface CollectedDeletions {
  readonly deletions: readonly ProjectedDeletion[];
  readonly materializedByteCount: number;
}

interface MutableDeletionMarker {
  deletedLineCount: number;
  readonly rewriteIds: Set<string>;
  readonly diffIds: Set<string>;
}

interface DeletionBoundaryBytes {
  readonly precedingByte?: number;
  readonly followingByte?: number;
  readonly materializedByteCount: number;
}

type DeletionBoundaryBytesResult =
  | { readonly ok: true; readonly value: DeletionBoundaryBytes }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

type DeletedTextResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly bytes: Uint8Array;
      readonly precedingByte?: number;
      readonly followingByte?: number;
      readonly materializedByteCount: number;
      readonly includesUnterminatedFinalLine: boolean;
    }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

export function deriveGraphRopeCausalLineDeletions(
  facts: GraphRopeRuntimeFactReader,
  input: GraphRopeCausalLineDeletionInput,
): GraphRopeCausalLineDeletionResult {
  const collected = collectProjectedDeletions(facts, input);
  if (!collected.ok) {
    return collected;
  }
  return groupDeletionMarkers(
    collected.value.deletions,
    input.nextText,
    input.transitions,
    input.maxDeletionCount,
  );
}

function collectProjectedDeletions(
  facts: GraphRopeRuntimeFactReader,
  input: GraphRopeCausalLineDeletionInput,
): { readonly ok: true; readonly value: CollectedDeletions }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode } {
  let collected: CollectedDeletions = { deletions: [], materializedByteCount: ZERO_VALUE };
  for (const transition of input.transitions) {
    const projected = collected.deletions.map(deletion => ({
      ...deletion,
      byteOffset: projectBoundary(deletion.byteOffset, transition.rewrite, transition.diff),
    }));
    const next = collectTransitionDeletion(facts, collected.materializedByteCount, transition, input);
    if (!next.ok) {
      return next;
    }
    collected = {
      deletions: next.deletion == null ? projected : [...projected, next.deletion],
      materializedByteCount: next.materializedByteCount,
    };
  }
  return { ok: true, value: collected };
}

function collectTransitionDeletion(
  facts: GraphRopeRuntimeFactReader,
  materializedByteCount: number,
  transition: CausalLineMarkerTransition,
  input: GraphRopeCausalLineDeletionInput,
): { readonly ok: true; readonly deletion?: ProjectedDeletion; readonly materializedByteCount: number }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode } {
  const deletedByteCount = byteLength(transition.rewrite);
  if (deletedByteCount === ZERO_VALUE) {
    return { ok: true, materializedByteCount };
  }
  const deleted = readDeletedText(
    facts,
    transition,
    input.maxHistoricalByteCount - materializedByteCount,
  );
  if (!deleted.ok) {
    return deleted;
  }
  const deletedLineCount = countDeletedLogicalLines(deleted);
  return {
    ok: true,
    materializedByteCount: materializedByteCount + deleted.materializedByteCount,
    ...(deletedLineCount === ZERO_VALUE ? {} : {
      deletion: projectedDeletion(transition, deletedLineCount),
    }),
  };
}

function projectedDeletion(
  transition: CausalLineMarkerTransition,
  deletedLineCount: number,
): ProjectedDeletion {
  const startByte = transition.rewrite.range.startByte.value;
  return {
    byteOffset: startByte + insertedByteLength(transition.diff),
    deletedLineCount,
    rewriteIds: [transition.rewrite.rewriteId],
    diffIds: [transition.diff.diffId],
  };
}

function readDeletedText(
  facts: GraphRopeRuntimeFactReader,
  transition: CausalLineMarkerTransition,
  maxHistoricalByteCount: number,
): DeletedTextResult {
  const basisHead = headById(facts, transition.rewrite.basisHeadId);
  if (basisHead === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CAUSAL_EVIDENCE };
  }
  const deletedByteCount = byteLength(transition.rewrite);
  if (deletedByteCount > maxHistoricalByteCount) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED };
  }
  const reading = readTreeWindow(facts, basisHead, transition.rewrite.range);
  return reading.ok
    ? deletedTextResult(facts, basisHead, transition, reading.value.text, maxHistoricalByteCount)
    : reading;
}

function deletedTextResult(
  facts: GraphRopeRuntimeFactReader,
  basisHead: RopeHeadFact,
  transition: CausalLineMarkerTransition,
  text: string,
  maxHistoricalByteCount: number,
): DeletedTextResult {
  const bytes = UTF8_ENCODER.encode(text);
  const boundaries = readDeletionBoundaryBytes(
    facts,
    basisHead,
    transition.rewrite,
    bytes,
    maxHistoricalByteCount,
  );
  if (!boundaries.ok) {
    return boundaries;
  }
  return {
    ok: true,
    text,
    bytes,
    ...boundaries.value,
    includesUnterminatedFinalLine: includesUnterminatedFinalLine(
      basisHead,
      transition.rewrite,
      bytes,
      boundaries.value.precedingByte,
    ),
  };
}

function readDeletionBoundaryBytes(
  facts: GraphRopeRuntimeFactReader,
  basisHead: RopeHeadFact,
  rewrite: RopeRewriteFact,
  bytes: Uint8Array,
  maxHistoricalByteCount: number,
): DeletionBoundaryBytesResult {
  let materializedByteCount = bytes.length;
  let precedingByte: number | undefined;
  let followingByte: number | undefined;
  if (needsPrecedingByte(basisHead, rewrite, bytes)) {
    const result = readBoundaryByte(facts, basisHead, rewrite.range.startByte.value - 1, maxHistoricalByteCount - materializedByteCount);
    if (!result.ok) {
      return result;
    }
    precedingByte = result.value;
    materializedByteCount += 1;
  }
  if (needsFollowingByte(basisHead, rewrite, bytes)) {
    const result = readBoundaryByte(facts, basisHead, rewrite.range.endByte.value, maxHistoricalByteCount - materializedByteCount);
    if (!result.ok) {
      return result;
    }
    followingByte = result.value;
    materializedByteCount += 1;
  }
  return { ok: true, value: { precedingByte, followingByte, materializedByteCount } };
}

function readBoundaryByte(
  facts: GraphRopeRuntimeFactReader,
  basisHead: RopeHeadFact,
  byteOffset: number,
  remainingByteCount: number,
): { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode } {
  if (remainingByteCount < 1) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED };
  }
  const reading = readTreeByteWindow(facts, basisHead, textByteRange(byteOffset, byteOffset + 1));
  if (!reading.ok) {
    return reading;
  }
  const byte = reading.value.bytes[ZERO_VALUE];
  if (byte === undefined) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  return { ok: true, value: byte };
}

function groupDeletionMarkers(
  deletions: readonly ProjectedDeletion[],
  nextText: string,
  transitions: readonly CausalLineMarkerTransition[],
  maxDeletionCount: number,
): GraphRopeCausalLineDeletionResult {
  const groups = new Map<number, MutableDeletionMarker>();
  for (const deletion of deletions) {
    const boundary = lineBoundaryNumber(nextText, deletion.byteOffset);
    const marker = groups.get(boundary) ?? newMutableDeletionMarker();
    marker.deletedLineCount += deletion.deletedLineCount;
    deletion.rewriteIds.forEach(id => marker.rewriteIds.add(id));
    deletion.diffIds.forEach(id => marker.diffIds.add(id));
    groups.set(boundary, marker);
    if (groups.size > maxDeletionCount) {
      return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED };
    }
  }
  const markers = [...groups.entries()].sort(([left], [right]) => left - right);
  return {
    ok: true,
    deletions: markers.map(([boundaryLineNumber, marker]) => ({
      boundaryLineNumber,
      deletedLineCount: marker.deletedLineCount,
      rewriteIds: orderedRewriteIds(transitions, marker.rewriteIds),
      diffIds: orderedDiffIds(transitions, marker.diffIds),
    })),
  };
}

function newMutableDeletionMarker(): MutableDeletionMarker {
  return { deletedLineCount: ZERO_VALUE, rewriteIds: new Set(), diffIds: new Set() };
}

function orderedRewriteIds(
  transitions: readonly CausalLineMarkerTransition[],
  retained: ReadonlySet<string>,
): readonly string[] {
  return transitions.map(({ rewrite }) => rewrite.rewriteId).filter(id => retained.has(id));
}

function orderedDiffIds(
  transitions: readonly CausalLineMarkerTransition[],
  retained: ReadonlySet<string>,
): readonly string[] {
  return transitions.map(({ diff }) => diff.diffId).filter(id => retained.has(id));
}

function projectBoundary(
  byteOffset: number,
  rewrite: RopeRewriteFact,
  diff: RopeDiffFact,
): number {
  const startByte = rewrite.range.startByte.value;
  const endByte = rewrite.range.endByte.value;
  const nextEndByte = startByte + insertedByteLength(diff);
  if (byteOffset < startByte) {
    return byteOffset;
  }
  return byteOffset >= endByte
    ? byteOffset + nextEndByte - endByte
    : nextEndByte;
}

function byteLength(rewrite: RopeRewriteFact): number {
  return rewrite.range.endByte.value - rewrite.range.startByte.value;
}

function insertedByteLength(diff: RopeDiffFact): number {
  return diff.spans.reduce((total, span) => span.kind === ROPE_DIFF_SPAN_INSERT_KIND
    ? total + span.nextRange.endByte.value - span.nextRange.startByte.value
    : total, ZERO_VALUE);
}

function countLogicalLineBreaks(bytes: Uint8Array): number {
  let count = ZERO_VALUE;
  for (let index = ZERO_VALUE; index < bytes.length; index += 1) {
    if (bytes[index] === CARRIAGE_RETURN_BYTE
        || (bytes[index] === LINE_FEED_BYTE && bytes[index - 1] !== CARRIAGE_RETURN_BYTE)) {
      count += 1;
    }
  }
  return count;
}

function countDeletedLogicalLines(deleted: Extract<DeletedTextResult, { readonly ok: true }>): number {
  return countLogicalLineBreaks(deleted.bytes)
    - splitCrLfBoundaryCount(deleted)
    + (deleted.includesUnterminatedFinalLine ? 1 : ZERO_VALUE);
}

function splitCrLfBoundaryCount(
  deleted: Extract<DeletedTextResult, { readonly ok: true }>,
): number {
  const leadingSplit = deleted.precedingByte === CARRIAGE_RETURN_BYTE
    && deleted.bytes[ZERO_VALUE] === LINE_FEED_BYTE;
  const trailingSplit = deleted.bytes[deleted.bytes.length - 1] === CARRIAGE_RETURN_BYTE
    && deleted.followingByte === LINE_FEED_BYTE;
  return (leadingSplit ? 1 : ZERO_VALUE) + (trailingSplit ? 1 : ZERO_VALUE);
}

function needsPrecedingByte(
  basisHead: RopeHeadFact,
  rewrite: RopeRewriteFact,
  bytes: Uint8Array,
): boolean {
  return rewrite.range.startByte.value > ZERO_VALUE
    && (bytes[ZERO_VALUE] === LINE_FEED_BYTE || isUnterminatedFinalRange(basisHead, rewrite, bytes));
}

function needsFollowingByte(
  basisHead: RopeHeadFact,
  rewrite: RopeRewriteFact,
  bytes: Uint8Array,
): boolean {
  return rewrite.range.endByte.value < basisHead.byteLength
    && bytes[bytes.length - 1] === CARRIAGE_RETURN_BYTE;
}

function includesUnterminatedFinalLine(
  basisHead: RopeHeadFact,
  rewrite: RopeRewriteFact,
  bytes: Uint8Array,
  precedingByte: number | undefined,
): boolean {
  return isUnterminatedFinalRange(basisHead, rewrite, bytes)
    && (rewrite.range.startByte.value === ZERO_VALUE
      || startsAfterLineBreak(precedingByte, bytes[ZERO_VALUE]));
}

function isUnterminatedFinalRange(
  basisHead: RopeHeadFact,
  rewrite: RopeRewriteFact,
  bytes: Uint8Array,
): boolean {
  const finalByte = bytes[bytes.length - 1];
  return rewrite.range.endByte.value === basisHead.byteLength
    && finalByte !== undefined
    && !isLineBreak(finalByte);
}

function startsAfterLineBreak(
  precedingByte: number | undefined,
  firstDeletedByte: number | undefined,
): boolean {
  return precedingByte === LINE_FEED_BYTE
    || (precedingByte === CARRIAGE_RETURN_BYTE && firstDeletedByte !== LINE_FEED_BYTE);
}

function isLineBreak(byte: number): boolean {
  return byte === CARRIAGE_RETURN_BYTE || byte === LINE_FEED_BYTE;
}

function lineBoundaryNumber(text: string, byteOffset: number): number {
  const starts = logicalLineStarts(UTF8_ENCODER.encode(text));
  const exact = starts.indexOf(byteOffset);
  if (exact >= ZERO_VALUE) {
    return exact;
  }
  const following = starts.findIndex(startByte => startByte > byteOffset);
  return following >= ZERO_VALUE ? following : starts.length;
}

function logicalLineStarts(bytes: Uint8Array): readonly number[] {
  const starts = [ZERO_VALUE];
  for (let index = ZERO_VALUE; index < bytes.length; index += 1) {
    if (bytes[index] === CARRIAGE_RETURN_BYTE) {
      index += bytes[index + 1] === LINE_FEED_BYTE ? 1 : ZERO_VALUE;
      starts.push(index + 1);
    } else if (bytes[index] === LINE_FEED_BYTE) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function headById(
  facts: GraphRopeRuntimeFactReader,
  headId: string,
): RopeHeadFact | null {
  const fact = facts.getFact(headId);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}
