import {
  ROPE_DIFF_SPAN_DELETE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_DIFF_SPAN_INSERT_KIND,
  type RopeDiffSpan,
  type TextBlobHashPort,
} from './graph-rope-types.js';

const RUNTIME_HASH_PREFIX_DIFF = 'diff:';

export interface RopeDiffContentHashInput {
  readonly rewriteId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly spans: readonly RopeDiffSpan[];
}

export function ropeDiffContentHash(input: RopeDiffContentHashInput, hash: TextBlobHashPort): string {
  return hash.sha256Hex([
    RUNTIME_HASH_PREFIX_DIFF,
    input.rewriteId,
    input.basisHeadId,
    input.nextHeadId,
    canonicalDiffSpanSet(input.spans),
  ].join(':'));
}

function canonicalDiffSpanSet(spans: readonly RopeDiffSpan[]): string {
  return spans.map(canonicalDiffSpan).join('|');
}

function canonicalDiffSpan(span: RopeDiffSpan): string {
  if (span.kind === ROPE_DIFF_SPAN_EQUAL_KIND) {
    return [
      span.kind,
      span.basisRange.startByte.value,
      span.basisRange.endByte.value,
      span.nextRange.startByte.value,
      span.nextRange.endByte.value,
      span.contentHash,
    ].join(':');
  }
  if (span.kind === ROPE_DIFF_SPAN_DELETE_KIND) {
    return [
      span.kind,
      span.basisRange.startByte.value,
      span.basisRange.endByte.value,
      span.contentHash,
    ].join(':');
  }
  if (span.kind === ROPE_DIFF_SPAN_INSERT_KIND) {
    return [
      span.kind,
      span.nextRange.startByte.value,
      span.nextRange.endByte.value,
      span.blobId,
      span.contentHash,
    ].join(':');
  }
  return `unknown:${JSON.stringify(span)}`;
}
