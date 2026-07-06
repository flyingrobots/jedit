import {
  BYTE_OFFSET_COORDINATE_KIND,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  ROPE_DIFF_SPAN_DELETE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_DIFF_SPAN_INSERT_KIND,
  type FactValidationErrorCode,
  type RopeDiffFact,
  type RopeDiffSpan,
  type RopeHeadFact,
  type RopeRewriteFact,
  type TextBlobFact,
  type TextBlobHashPort,
} from './graph-rope-types.js';

const ZERO_VALUE = 0;
const RUNTIME_HASH_PREFIX_SPAN = 'span:';

export interface RopeRewriteDiffSemanticsInput {
  readonly rewrite: RopeRewriteFact;
  readonly basisHead: RopeHeadFact;
  readonly nextHead: RopeHeadFact;
  readonly diff: RopeDiffFact;
  readonly replacementBlob: TextBlobFact;
  readonly hash: TextBlobHashPort;
}

export function validateRopeRewriteDiffSemantics(
  input: RopeRewriteDiffSemanticsInput,
): FactValidationErrorCode | null {
  return rewriteRangeFitsBasis(input.rewrite, input.basisHead)
    && rewriteNextLengthMatches(input)
    && diffSpansMatch(input.diff.spans, expectedDiffSpans(input))
    ? null
    : FACT_VALIDATION_ERROR_INVALID_REFERENCE;
}

function rewriteRangeFitsBasis(rewrite: RopeRewriteFact, basisHead: RopeHeadFact): boolean {
  return rewrite.range.endByte.value <= basisHead.byteLength;
}

function rewriteNextLengthMatches(input: RopeRewriteDiffSemanticsInput): boolean {
  return input.nextHead.byteLength === input.basisHead.byteLength
    - (input.rewrite.range.endByte.value - input.rewrite.range.startByte.value)
    + input.replacementBlob.byteLength;
}

function expectedDiffSpans(input: RopeRewriteDiffSemanticsInput): readonly RopeDiffSpan[] {
  const replacementLength = input.replacementBlob.byteLength;
  return [
    ...expectedEqualSpan(ZERO_VALUE, input.rewrite.range.startByte.value, ZERO_VALUE, input.rewrite.range.startByte.value, input.hash),
    ...expectedDeleteSpan(input.rewrite.range.startByte.value, input.rewrite.range.endByte.value, input.hash),
    ...expectedInsertSpan(input.rewrite.range.startByte.value, replacementLength, input.replacementBlob.blobId, input.hash),
    ...expectedEqualSpan(
      input.rewrite.range.endByte.value,
      input.basisHead.byteLength,
      input.rewrite.range.startByte.value + replacementLength,
      input.nextHead.byteLength,
      input.hash,
    ),
  ];
}

function expectedEqualSpan(
  basisStart: number,
  basisEnd: number,
  nextStart: number,
  nextEnd: number,
  hash: TextBlobHashPort,
): readonly RopeDiffSpan[] {
  if (basisStart === basisEnd) {
    return [];
  }
  return [{
    kind: ROPE_DIFF_SPAN_EQUAL_KIND,
    basisRange: textByteRange(basisStart, basisEnd),
    nextRange: textByteRange(nextStart, nextEnd),
    contentHash: spanHash('equal', basisStart, basisEnd, hash),
  }];
}

function expectedDeleteSpan(
  basisStart: number,
  basisEnd: number,
  hash: TextBlobHashPort,
): readonly RopeDiffSpan[] {
  if (basisStart === basisEnd) {
    return [];
  }
  return [{
    kind: ROPE_DIFF_SPAN_DELETE_KIND,
    basisRange: textByteRange(basisStart, basisEnd),
    contentHash: spanHash('delete', basisStart, basisEnd, hash),
  }];
}

function expectedInsertSpan(
  nextStart: number,
  byteLength: number,
  blobId: string,
  hash: TextBlobHashPort,
): readonly RopeDiffSpan[] {
  if (byteLength === ZERO_VALUE) {
    return [];
  }
  const nextEnd = nextStart + byteLength;
  return [{
    kind: ROPE_DIFF_SPAN_INSERT_KIND,
    nextRange: textByteRange(nextStart, nextEnd),
    blobId,
    contentHash: spanHash('insert', nextStart, nextEnd, hash),
  }];
}

function diffSpansMatch(actual: readonly RopeDiffSpan[], expected: readonly RopeDiffSpan[]): boolean {
  return actual.length === expected.length && actual.every((span, index) => diffSpanMatches(span, expected[index]));
}

function diffSpanMatches(actual: RopeDiffSpan, expected: RopeDiffSpan | undefined): boolean {
  if (!diffSpanComparable(actual, expected)) {
    return false;
  }
  return diffSpanPayloadMatches(actual, expected);
}

function diffSpanComparable(actual: RopeDiffSpan, expected: RopeDiffSpan | undefined): expected is RopeDiffSpan {
  return expected !== undefined
    && actual.kind === expected.kind
    && actual.contentHash === expected.contentHash;
}

function diffSpanPayloadMatches(actual: RopeDiffSpan, expected: RopeDiffSpan): boolean {
  if (actual.kind === ROPE_DIFF_SPAN_EQUAL_KIND && expected.kind === ROPE_DIFF_SPAN_EQUAL_KIND) {
    return equalSpanMatches(actual, expected);
  }
  if (actual.kind === ROPE_DIFF_SPAN_DELETE_KIND && expected.kind === ROPE_DIFF_SPAN_DELETE_KIND) {
    return rangesMatch(actual.basisRange, expected.basisRange);
  }
  return actual.kind === ROPE_DIFF_SPAN_INSERT_KIND
    && expected.kind === ROPE_DIFF_SPAN_INSERT_KIND
    && insertSpanMatches(actual, expected);
}

function equalSpanMatches(
  actual: Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_EQUAL_KIND }>,
  expected: Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_EQUAL_KIND }>,
): boolean {
  return rangesMatch(actual.basisRange, expected.basisRange)
    && rangesMatch(actual.nextRange, expected.nextRange);
}

function insertSpanMatches(
  actual: Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_INSERT_KIND }>,
  expected: Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_INSERT_KIND }>,
): boolean {
  return rangesMatch(actual.nextRange, expected.nextRange)
    && actual.blobId === expected.blobId;
}

function rangesMatch(left: RopeRewriteFact['range'], right: RopeRewriteFact['range']): boolean {
  return left.startByte.kind === right.startByte.kind
    && left.startByte.value === right.startByte.value
    && left.endByte.kind === right.endByte.kind
    && left.endByte.value === right.endByte.value;
}

function spanHash(kind: string, startByte: number, endByte: number, hash: TextBlobHashPort): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_SPAN}${kind}:${String(startByte)}:${String(endByte)}`);
}

function textByteRange(startByte: number, endByte: number): RopeRewriteFact['range'] {
  return {
    startByte: { kind: BYTE_OFFSET_COORDINATE_KIND, value: startByte },
    endByte: { kind: BYTE_OFFSET_COORDINATE_KIND, value: endByte },
  };
}
