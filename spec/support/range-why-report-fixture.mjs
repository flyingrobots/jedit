const RANGE_REPORT_KIND = 'range';
const RANGE_REPORT_TITLE = 'Why range';
const PRODUCED_RESULT_KIND = 'produced';
const UNAVAILABLE_RESULT_KIND = 'unavailable';
const COMPLETE_COVERAGE_KIND = 'COMPLETE';
const REWRITE_ORIGIN_KIND = 'REWRITE';
const PRODUCER_EVIDENCE_UNAVAILABLE_KIND = 'UNAVAILABLE';
const DEFAULT_WORLDLINE_ID = 'wl:/repo/notes.md';
const DEFAULT_BASIS_HEAD_ID = 'head:command';
const DEFAULT_LEAF_ID = 'leaf:range';
const DEFAULT_BLOB_ID = 'blob:range';
const DEFAULT_REWRITE_ID = 'rewrite:range';
const DEFAULT_DIFF_ID = 'diff:range';
const DEFAULT_TEXT_TICK_RECEIPT_ID = 'tick:range';
const DEFAULT_REWRITE_BASIS_HEAD_ID = 'head:before';
const DEFAULT_PRODUCER_EVIDENCE_CODE = 'jedit_why_range_producer_evidence_unavailable';
const DEFAULT_UNAVAILABLE_CODE = 'jedit_why_range_retained_history_horizon';
const DEFAULT_UNAVAILABLE_REASON = 'Retained rope history does not identify a producing diff for this range.';
const DEFAULT_OBSERVER_VERSION = 'test-fixture';
const DEFAULT_INSPECTED_FACT_COUNT = 1;

export function producedRangeWhyReport(range, overrides = {}) {
  const evidence = producedEvidence(range, overrides);
  return {
    kind: RANGE_REPORT_KIND,
    title: RANGE_REPORT_TITLE,
    message: evidence.message,
    witness: {
      worldlineId: evidence.worldlineId,
      basisHeadId: evidence.basisHeadId,
      queriedRange: copyRange(range),
      result: producedResult(range, evidence),
    },
  };
}

export function unavailableRangeWhyReport(range, overrides = {}) {
  const code = overrides.code ?? DEFAULT_UNAVAILABLE_CODE;
  return {
    kind: RANGE_REPORT_KIND,
    title: RANGE_REPORT_TITLE,
    message: overrides.message ?? `No retained rope diff proves range ${formatRange(range)}: ${code}`,
    witness: {
      worldlineId: overrides.worldlineId ?? DEFAULT_WORLDLINE_ID,
      basisHeadId: overrides.basisHeadId ?? DEFAULT_BASIS_HEAD_ID,
      queriedRange: copyRange(range),
      result: {
        kind: UNAVAILABLE_RESULT_KIND,
        code,
        reason: overrides.reason ?? DEFAULT_UNAVAILABLE_REASON,
      },
    },
  };
}

function producedEvidence(range, overrides) {
  return {
    message: overrides.message ?? `range: ${formatRange(range)} | ropeDiff receipt:range`,
    worldlineId: overrides.worldlineId ?? DEFAULT_WORLDLINE_ID,
    basisHeadId: overrides.basisHeadId ?? DEFAULT_BASIS_HEAD_ID,
    leafId: overrides.leafId ?? DEFAULT_LEAF_ID,
    blobId: overrides.blobId ?? DEFAULT_BLOB_ID,
    rewriteId: overrides.rewriteId ?? DEFAULT_REWRITE_ID,
    diffId: overrides.diffId ?? DEFAULT_DIFF_ID,
    textTickReceiptId: overrides.textTickReceiptId ?? DEFAULT_TEXT_TICK_RECEIPT_ID,
    rewriteBasisHeadId: overrides.rewriteBasisHeadId ?? DEFAULT_REWRITE_BASIS_HEAD_ID,
    producerEvidenceCode: overrides.producerEvidenceCode ?? DEFAULT_PRODUCER_EVIDENCE_CODE,
    relatedCheckpoints: (overrides.relatedCheckpoints ?? []).map(copyCheckpoint),
    inspectedFactCount: overrides.inspectedFactCount ?? DEFAULT_INSPECTED_FACT_COUNT,
    observerVersion: overrides.observerVersion ?? DEFAULT_OBSERVER_VERSION,
  };
}

function producedResult(range, evidence) {
  return {
    kind: PRODUCED_RESULT_KIND,
    coverage: {
      kind: COMPLETE_COVERAGE_KIND,
      coveredRange: copyRange(range),
      continuation: null,
      reason: null,
    },
    fragments: [rewriteFragment(range, evidence)],
    relatedCheckpoints: evidence.relatedCheckpoints,
    inspectedFactCount: evidence.inspectedFactCount,
    observerVersion: evidence.observerVersion,
  };
}

function rewriteFragment(range, evidence) {
  return {
    coveredRange: copyRange(range),
    headId: evidence.basisHeadId,
    leafId: evidence.leafId,
    blobId: evidence.blobId,
    origin: {
      kind: REWRITE_ORIGIN_KIND,
      rewriteId: evidence.rewriteId,
      diffId: evidence.diffId,
      textTickReceiptId: evidence.textTickReceiptId,
      basisHeadId: evidence.rewriteBasisHeadId,
      nextHeadId: evidence.basisHeadId,
      producerEvidence: {
        kind: PRODUCER_EVIDENCE_UNAVAILABLE_KIND,
        code: evidence.producerEvidenceCode,
      },
    },
  };
}

function copyCheckpoint(checkpoint) {
  return {
    ...checkpoint,
    anchorAssociation: checkpoint.anchorAssociation == null
      ? null
      : { ...checkpoint.anchorAssociation },
  };
}

function copyRange(range) {
  return { startByte: range.startByte, endByte: range.endByte };
}

function formatRange(range) {
  return `${String(range.startByte)}..${String(range.endByte)}`;
}
