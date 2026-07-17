import {
  JeditWhyRangeOriginKinds,
  RESULT_PRODUCED,
  type JeditWhyRangeCheckpointEvidence,
  type JeditWhyRangeFragment,
  type JeditWhyRangeReport,
} from '../../ports/jedit-why-range.js';

const DETAIL_ROW_LIMIT = 24;
const OMITTED_DETAIL_ROW = '...';
const DETAIL_FIELD_VALUE_SEPARATOR = '=';
const DETAIL_FIELD_SEPARATOR = ' ';
const RANGE_BOUNDARY_SEPARATOR = '..';
const WHY_DETAIL_FIELDS = Object.freeze({
  BasisHeadId: 'basisHeadId',
  BlobId: 'blobId',
  CausalAnchorId: 'causalAnchorId',
  CausalAnchorReceiptId: 'causalAnchorReceiptId',
  CheckpointId: 'checkpointId',
  Code: 'code',
  Coverage: 'coverage',
  CreatedAtTickId: 'createdAtTickId',
  DiffId: 'diffId',
  HeadId: 'headId',
  InitialHeadId: 'initialHeadId',
  InspectedFactCount: 'inspectedFactCount',
  LeafId: 'leafId',
  NextHeadId: 'nextHeadId',
  Origin: 'origin',
  ProducerEvidence: 'producerEvidence',
  Range: 'range',
  Reason: 'reason',
  RewriteId: 'rewriteId',
  Span: 'span',
  TextTickReceiptId: 'textTickReceiptId',
} as const);

type WhyDetailField = (typeof WHY_DETAIL_FIELDS)[keyof typeof WHY_DETAIL_FIELDS];

export function jeditWhyRangeDetailRows(report: JeditWhyRangeReport): readonly string[] {
  const { witness } = report;
  if (witness.result.kind !== RESULT_PRODUCED) {
    return [
      detailField(WHY_DETAIL_FIELDS.Code, witness.result.code),
      detailField(WHY_DETAIL_FIELDS.Reason, witness.result.reason),
    ];
  }
  const rows = [
    detailField(WHY_DETAIL_FIELDS.BasisHeadId, witness.basisHeadId),
    detailRow([
      detailField(WHY_DETAIL_FIELDS.Range, formatRange(witness.queriedRange)),
      detailField(WHY_DETAIL_FIELDS.Coverage, witness.result.coverage.kind),
    ]),
    ...witness.result.fragments.flatMap(fragmentDetailRows),
    ...witness.result.relatedCheckpoints.flatMap(checkpointDetailRows),
    detailField(WHY_DETAIL_FIELDS.InspectedFactCount, witness.result.inspectedFactCount),
  ];
  return boundedDetailRows(rows);
}

function fragmentDetailRows(fragment: JeditWhyRangeFragment): readonly string[] {
  return [
    detailRow([
      detailField(WHY_DETAIL_FIELDS.Span, formatRange(fragment.coveredRange)),
      detailField(WHY_DETAIL_FIELDS.LeafId, fragment.leafId),
      detailField(WHY_DETAIL_FIELDS.BlobId, fragment.blobId),
    ]),
    ...originDetailRows(fragment),
  ];
}

function originDetailRows(fragment: JeditWhyRangeFragment): readonly string[] {
  const origin = fragment.origin;
  if (origin.kind === JeditWhyRangeOriginKinds.Imported) {
    return [detailRow([
      detailField(WHY_DETAIL_FIELDS.Origin, origin.kind),
      detailField(WHY_DETAIL_FIELDS.InitialHeadId, origin.initialHeadId),
      detailField(WHY_DETAIL_FIELDS.CreatedAtTickId, origin.createdAtTickId),
    ])];
  }
  if (origin.kind === JeditWhyRangeOriginKinds.Rewrite) {
    return [
      detailRow([
        detailField(WHY_DETAIL_FIELDS.Origin, origin.kind),
        detailField(WHY_DETAIL_FIELDS.RewriteId, origin.rewriteId),
        detailField(WHY_DETAIL_FIELDS.DiffId, origin.diffId),
      ]),
      detailRow([
        detailField(WHY_DETAIL_FIELDS.TextTickReceiptId, origin.textTickReceiptId),
        detailField(WHY_DETAIL_FIELDS.BasisHeadId, origin.basisHeadId),
        detailField(WHY_DETAIL_FIELDS.NextHeadId, origin.nextHeadId),
      ]),
      detailRow([
        detailField(WHY_DETAIL_FIELDS.ProducerEvidence, origin.producerEvidence.kind),
        detailField(WHY_DETAIL_FIELDS.Code, origin.producerEvidence.code),
      ]),
    ];
  }
  return [detailRow([
    detailField(WHY_DETAIL_FIELDS.Origin, origin.kind),
    detailField(WHY_DETAIL_FIELDS.Code, origin.code),
  ])];
}

function checkpointDetailRows(checkpoint: JeditWhyRangeCheckpointEvidence): readonly string[] {
  const rows = [
    detailRow([
      detailField(WHY_DETAIL_FIELDS.CheckpointId, checkpoint.checkpointId),
      detailField(WHY_DETAIL_FIELDS.HeadId, checkpoint.headId),
      detailField(WHY_DETAIL_FIELDS.Reason, checkpoint.reason),
    ]),
  ];
  return checkpoint.anchorAssociation == null
    ? rows
    : [
        ...rows,
        detailRow([
          detailField(WHY_DETAIL_FIELDS.CausalAnchorId, checkpoint.anchorAssociation.causalAnchorId),
          detailField(WHY_DETAIL_FIELDS.CausalAnchorReceiptId, checkpoint.anchorAssociation.causalAnchorReceiptId),
        ]),
      ];
}

function boundedDetailRows(rows: readonly string[]): readonly string[] {
  return rows.length <= DETAIL_ROW_LIMIT
    ? rows
    : [...rows.slice(0, DETAIL_ROW_LIMIT - 1), OMITTED_DETAIL_ROW];
}

function formatRange(range: { readonly startByte: number; readonly endByte: number }): string {
  return `${String(range.startByte)}${RANGE_BOUNDARY_SEPARATOR}${String(range.endByte)}`;
}

function detailField(field: WhyDetailField, value: string | number): string {
  return `${field}${DETAIL_FIELD_VALUE_SEPARATOR}${String(value)}`;
}

function detailRow(fields: readonly string[]): string {
  return fields.join(DETAIL_FIELD_SEPARATOR);
}
