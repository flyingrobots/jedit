import {
  JeditWhyRangeOriginKinds,
  RESULT_PRODUCED,
  type JeditWhyRangeCheckpointEvidence,
  type JeditWhyRangeFragment,
  type JeditWhyRangeReport,
} from '../../ports/jedit-why-range.js';

const DETAIL_ROW_LIMIT = 24;
const OMITTED_DETAIL_ROW = '...';

export function jeditWhyRangeDetailRows(report: JeditWhyRangeReport): readonly string[] {
  const { witness } = report;
  if (witness.result.kind !== RESULT_PRODUCED) {
    return [`code=${witness.result.code}`, `reason=${witness.result.reason}`];
  }
  const rows = [
    `basisHeadId=${witness.basisHeadId}`,
    `range=${formatRange(witness.queriedRange)} coverage=${witness.result.coverage.kind}`,
    ...witness.result.fragments.flatMap(fragmentDetailRows),
    ...witness.result.relatedCheckpoints.flatMap(checkpointDetailRows),
    `inspectedFactCount=${String(witness.result.inspectedFactCount)}`,
  ];
  return boundedDetailRows(rows);
}

function fragmentDetailRows(fragment: JeditWhyRangeFragment): readonly string[] {
  return [
    `span=${formatRange(fragment.coveredRange)} leafId=${fragment.leafId} blobId=${fragment.blobId}`,
    ...originDetailRows(fragment),
  ];
}

function originDetailRows(fragment: JeditWhyRangeFragment): readonly string[] {
  const origin = fragment.origin;
  if (origin.kind === JeditWhyRangeOriginKinds.Imported) {
    return [`origin=IMPORTED initialHeadId=${origin.initialHeadId} createdAtTickId=${origin.createdAtTickId}`];
  }
  if (origin.kind === JeditWhyRangeOriginKinds.Rewrite) {
    return [
      `origin=REWRITE rewriteId=${origin.rewriteId} diffId=${origin.diffId}`,
      `textTickReceiptId=${origin.textTickReceiptId} basisHeadId=${origin.basisHeadId} nextHeadId=${origin.nextHeadId}`,
      `producerEvidence=${origin.producerEvidence.kind} code=${origin.producerEvidence.code}`,
    ];
  }
  return [`origin=UNAVAILABLE code=${origin.code}`];
}

function checkpointDetailRows(checkpoint: JeditWhyRangeCheckpointEvidence): readonly string[] {
  const rows = [
    `checkpointId=${checkpoint.checkpointId} headId=${checkpoint.headId} reason=${checkpoint.reason}`,
  ];
  return checkpoint.anchorAssociation == null
    ? rows
    : [
        ...rows,
        `causalAnchorId=${checkpoint.anchorAssociation.causalAnchorId} causalAnchorReceiptId=${checkpoint.anchorAssociation.causalAnchorReceiptId}`,
      ];
}

function boundedDetailRows(rows: readonly string[]): readonly string[] {
  return rows.length <= DETAIL_ROW_LIMIT
    ? rows
    : [...rows.slice(0, DETAIL_ROW_LIMIT - 1), OMITTED_DETAIL_ROW];
}

function formatRange(range: { readonly startByte: number; readonly endByte: number }): string {
  return `${String(range.startByte)}..${String(range.endByte)}`;
}
