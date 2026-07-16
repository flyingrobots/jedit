import {
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_DIFF_SPAN_INSERT_KIND,
  type RopeDiffFact,
  type RopeEqualDiffSpan,
  type RopeInsertDiffSpan,
  type RopeRewriteFact,
  type TickReceiptFact,
} from './graph-rope-contract.js';

const ZERO_VALUE = 0;
const CARRIAGE_RETURN_BYTE = 0x0d;
const LINE_FEED_BYTE = 0x0a;
const TOUCH_BEFORE = 'before';
const TOUCH_AFTER = 'after';
const UTF8_ENCODER = new TextEncoder();

export const CAUSAL_LINE_MARKER_KIND = {
  Inserted: 'INSERTED',
  Modified: 'MODIFIED',
} as const;

export type CausalLineMarkerKind =
  (typeof CAUSAL_LINE_MARKER_KIND)[keyof typeof CAUSAL_LINE_MARKER_KIND];

export interface CausalLineMarker {
  readonly lineNumber: number;
  readonly kind: CausalLineMarkerKind;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface CausalLineMarkerTransition {
  readonly receipt: TickReceiptFact;
  readonly rewrite: RopeRewriteFact;
  readonly diff: RopeDiffFact;
}

export type CausalLineMarkersResult =
  | { readonly ok: true; readonly markers: readonly CausalLineMarker[] }
  | { readonly ok: false };

export interface CausalLineMarkersInput {
  readonly basisText: string;
  readonly nextText: string;
  readonly transitions: readonly CausalLineMarkerTransition[];
  readonly maxMarkerCount: number;
}

interface ProvenanceSegment {
  readonly startByte: number;
  readonly endByte: number;
  readonly basisStartByte: number | null;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

interface ProvenanceTouch {
  readonly byteOffset: number;
  readonly bias: typeof TOUCH_BEFORE | typeof TOUCH_AFTER;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

interface ProvenanceState {
  readonly segments: readonly ProvenanceSegment[];
  readonly touches: readonly ProvenanceTouch[];
}

interface LineExtent {
  readonly lineNumber: number;
  readonly startByte: number;
  readonly endByte: number;
}

export function deriveCausalLineMarkers(
  input: CausalLineMarkersInput,
): CausalLineMarkersResult {
  const basisBytes = UTF8_ENCODER.encode(input.basisText);
  const nextBytes = UTF8_ENCODER.encode(input.nextText);
  const state = replayProvenance(basisBytes.length, input.transitions);
  const basisLines = lineExtents(basisBytes);
  const markers: CausalLineMarker[] = [];
  for (const line of lineExtents(nextBytes)) {
    const kind = causalLineKind(line, basisLines, basisBytes, nextBytes, state);
    if (kind === null) {
      continue;
    }
    if (markers.length >= input.maxMarkerCount) {
      return { ok: false };
    }
    markers.push(causalLineMarker(line, kind, state, input.transitions));
  }
  return { ok: true, markers };
}

function causalLineKind(
  line: LineExtent,
  basisLines: readonly LineExtent[],
  basisBytes: Uint8Array,
  nextBytes: Uint8Array,
  state: ProvenanceState,
): CausalLineMarkerKind | null {
  if (line.startByte === line.endByte) {
    return zeroLengthLineKind(line, basisBytes, nextBytes, state.segments);
  }
  const pieces = lineProvenancePieces(line, state.segments);
  if (piecesCoverLine(pieces, line) && pieces.every(piece => piece.basisStartByte === null)) {
    return CAUSAL_LINE_MARKER_KIND.Inserted;
  }
  return mapsCompleteBasisLine(pieces, line, basisLines)
    ? null
    : CAUSAL_LINE_MARKER_KIND.Modified;
}

function zeroLengthLineKind(
  line: LineExtent,
  basisBytes: Uint8Array,
  nextBytes: Uint8Array,
  segments: readonly ProvenanceSegment[],
): CausalLineMarkerKind | null {
  if (nextBytes.length === ZERO_VALUE) {
    return basisBytes.length === ZERO_VALUE ? null : CAUSAL_LINE_MARKER_KIND.Modified;
  }
  const precedingByte = line.startByte - 1;
  const segment = segmentAtByte(segments, precedingByte);
  if (segment?.basisStartByte === null) {
    return CAUSAL_LINE_MARKER_KIND.Inserted;
  }
  if (segment === undefined || nextBytes[precedingByte] !== LINE_FEED_BYTE) {
    return CAUSAL_LINE_MARKER_KIND.Modified;
  }
  const basisByte = segment.basisStartByte + (precedingByte - segment.startByte);
  return basisByte === basisBytes.length - 1 && basisBytes[basisByte] === LINE_FEED_BYTE
    ? null
    : CAUSAL_LINE_MARKER_KIND.Modified;
}

function causalLineMarker(
  line: LineExtent,
  kind: CausalLineMarkerKind,
  state: ProvenanceState,
  transitions: readonly CausalLineMarkerTransition[],
): CausalLineMarker {
  const pieces = lineProvenancePieces(line, state.segments);
  const touches = state.touches.filter(touch => touchSupportsLine(touch, line));
  const directSupport = [...pieces, ...touches];
  const directRewriteIds = new Set(directSupport.flatMap(item => item.rewriteIds));
  const support = directRewriteIds.size > ZERO_VALUE
    ? directSupport
    : [...directSupport, ...state.touches.filter(touch => touchAtLineBoundary(touch, line))];
  const rewriteIds = new Set(support.flatMap(item => item.rewriteIds));
  const diffIds = new Set(support.flatMap(item => item.diffIds));
  return {
    lineNumber: line.lineNumber,
    kind,
    tickReceiptIds: transitions
      .filter(({ rewrite }) => rewriteIds.has(rewrite.rewriteId))
      .map(({ receipt }) => receipt.tickId),
    rewriteIds: transitions.map(({ rewrite }) => rewrite.rewriteId).filter(id => rewriteIds.has(id)),
    diffIds: transitions.map(({ diff }) => diff.diffId).filter(id => diffIds.has(id)),
  };
}

function replayProvenance(
  basisByteLength: number,
  transitions: readonly CausalLineMarkerTransition[],
): ProvenanceState {
  let state: ProvenanceState = {
    segments: basisByteLength === ZERO_VALUE ? [] : [{
      startByte: ZERO_VALUE,
      endByte: basisByteLength,
      basisStartByte: ZERO_VALUE,
      rewriteIds: [],
      diffIds: [],
    }],
    touches: [],
  };
  for (const transition of transitions) {
    state = applyTransition(state, transition);
  }
  return state;
}

function applyTransition(
  state: ProvenanceState,
  transition: CausalLineMarkerTransition,
): ProvenanceState {
  const segments = transition.diff.spans.flatMap(span => {
    if (span.kind === ROPE_DIFF_SPAN_EQUAL_KIND) {
      return remapEqualSegments(state.segments, span);
    }
    return span.kind === ROPE_DIFF_SPAN_INSERT_KIND
      ? [insertedSegment(span, transition)]
      : [];
  });
  return {
    segments: segments.sort((left, right) => left.startByte - right.startByte),
    touches: transitionTouches(state.touches, transition),
  };
}

function remapEqualSegments(
  segments: readonly ProvenanceSegment[],
  span: RopeEqualDiffSpan,
): readonly ProvenanceSegment[] {
  const basisStart = span.basisRange.startByte.value;
  const basisEnd = span.basisRange.endByte.value;
  const nextStart = span.nextRange.startByte.value;
  return segments.flatMap(segment => {
    const startByte = Math.max(segment.startByte, basisStart);
    const endByte = Math.min(segment.endByte, basisEnd);
    if (startByte >= endByte) {
      return [];
    }
    return [{
      ...segment,
      startByte: nextStart + (startByte - basisStart),
      endByte: nextStart + (endByte - basisStart),
      basisStartByte: segment.basisStartByte === null
        ? null
        : segment.basisStartByte + (startByte - segment.startByte),
    }];
  });
}

function insertedSegment(
  span: RopeInsertDiffSpan,
  transition: CausalLineMarkerTransition,
): ProvenanceSegment {
  return {
    startByte: span.nextRange.startByte.value,
    endByte: span.nextRange.endByte.value,
    basisStartByte: null,
    rewriteIds: [transition.rewrite.rewriteId],
    diffIds: [transition.diff.diffId],
  };
}

function transitionTouches(
  touches: readonly ProvenanceTouch[],
  transition: CausalLineMarkerTransition,
): readonly ProvenanceTouch[] {
  const startByte = transition.rewrite.range.startByte.value;
  const endByte = transition.rewrite.range.endByte.value;
  const nextEndByte = startByte + insertedByteLength(transition.diff);
  const retained = touches.flatMap(touch => remapTouch(touch, startByte, endByte, nextEndByte));
  const support = {
    rewriteIds: [transition.rewrite.rewriteId],
    diffIds: [transition.diff.diffId],
  };
  return [
    ...retained,
    { byteOffset: startByte, bias: TOUCH_AFTER, ...support },
    { byteOffset: nextEndByte, bias: TOUCH_BEFORE, ...support },
  ];
}

function remapTouch(
  touch: ProvenanceTouch,
  startByte: number,
  endByte: number,
  nextEndByte: number,
): readonly ProvenanceTouch[] {
  if (touch.byteOffset < startByte) {
    return [touch];
  }
  if (touch.byteOffset > endByte) {
    return [{ ...touch, byteOffset: touch.byteOffset + nextEndByte - endByte }];
  }
  if (touch.byteOffset > startByte && touch.byteOffset < endByte) {
    return [];
  }
  return [{
    ...touch,
    byteOffset: touch.bias === TOUCH_AFTER ? nextEndByte : startByte,
  }];
}

function insertedByteLength(diff: RopeDiffFact): number {
  return diff.spans.reduce((total, span) => span.kind === ROPE_DIFF_SPAN_INSERT_KIND
    ? total + span.nextRange.endByte.value - span.nextRange.startByte.value
    : total, ZERO_VALUE);
}

function lineProvenancePieces(
  line: LineExtent,
  segments: readonly ProvenanceSegment[],
): readonly ProvenanceSegment[] {
  return segments.flatMap(segment => {
    const startByte = Math.max(line.startByte, segment.startByte);
    const endByte = Math.min(line.endByte, segment.endByte);
    if (startByte >= endByte) {
      return [];
    }
    return [{
      ...segment,
      startByte,
      endByte,
      basisStartByte: segment.basisStartByte === null
        ? null
        : segment.basisStartByte + (startByte - segment.startByte),
    }];
  });
}

function piecesCoverLine(
  pieces: readonly ProvenanceSegment[],
  line: LineExtent,
): boolean {
  let nextByte = line.startByte;
  for (const piece of pieces) {
    if (piece.startByte !== nextByte) {
      return false;
    }
    nextByte = piece.endByte;
  }
  return nextByte === line.endByte;
}

function mapsCompleteBasisLine(
  pieces: readonly ProvenanceSegment[],
  line: LineExtent,
  basisLines: readonly LineExtent[],
): boolean {
  if (!piecesCoverLine(pieces, line) || pieces.some(piece => piece.basisStartByte === null)) {
    return false;
  }
  const firstBasisByte = pieces[0]?.basisStartByte;
  if (firstBasisByte === null || firstBasisByte === undefined) {
    return false;
  }
  let nextBasisByte = firstBasisByte;
  for (const piece of pieces) {
    if (piece.basisStartByte !== nextBasisByte) {
      return false;
    }
    nextBasisByte += piece.endByte - piece.startByte;
  }
  return basisLines.some(basisLine =>
    basisLine.startByte === firstBasisByte && basisLine.endByte === nextBasisByte);
}

function touchSupportsLine(touch: ProvenanceTouch, line: LineExtent): boolean {
  if (line.startByte === line.endByte) {
    return touch.byteOffset === line.startByte;
  }
  return touch.bias === TOUCH_AFTER
    ? touch.byteOffset >= line.startByte && touch.byteOffset < line.endByte
    : touch.byteOffset > line.startByte && touch.byteOffset <= line.endByte;
}

function touchAtLineBoundary(touch: ProvenanceTouch, line: LineExtent): boolean {
  return touch.byteOffset === line.startByte || touch.byteOffset === line.endByte;
}

function segmentAtByte(
  segments: readonly ProvenanceSegment[],
  byteOffset: number,
): ProvenanceSegment | undefined {
  return segments.find(segment =>
    byteOffset >= segment.startByte && byteOffset < segment.endByte);
}

function lineExtents(bytes: Uint8Array): readonly LineExtent[] {
  const lines: LineExtent[] = [];
  let startByte = ZERO_VALUE;
  for (let byteOffset = ZERO_VALUE; byteOffset < bytes.length; byteOffset += 1) {
    const endByte = logicalLineBreakEnd(bytes, byteOffset);
    if (endByte == null) {
      continue;
    }
    lines.push({ lineNumber: lines.length, startByte, endByte });
    startByte = endByte;
    byteOffset = endByte - 1;
  }
  lines.push({ lineNumber: lines.length, startByte, endByte: bytes.length });
  return lines;
}

function logicalLineBreakEnd(bytes: Uint8Array, byteOffset: number): number | undefined {
  if (bytes[byteOffset] === LINE_FEED_BYTE) {
    return byteOffset + 1;
  }
  if (bytes[byteOffset] !== CARRIAGE_RETURN_BYTE) {
    return undefined;
  }
  return byteOffset + (bytes[byteOffset + 1] === LINE_FEED_BYTE ? 2 : 1);
}
