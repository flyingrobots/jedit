export {
  JEDIT_EVIDENCE_BYTE_IDENTITY_KIND,
  JEDIT_EVIDENCE_ROLE_PACKAGE,
  JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
  JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
  JEDIT_EVIDENCE_ROLE_RECEIPT,
  JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND,
  JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE,
  JEDIT_RETAINED_EVIDENCE_REF_KIND,
  JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL,
} from '../ports/jedit-retained-evidence.js';
import {
  JEDIT_EVIDENCE_BYTE_IDENTITY_KIND,
  JEDIT_EVIDENCE_ROLE_PACKAGE,
  JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
  JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
  JEDIT_EVIDENCE_ROLE_RECEIPT,
  JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND,
  JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE,
  JEDIT_RETAINED_EVIDENCE_REF_KIND,
  JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL,
  type JeditRetainedEvidenceInventory,
  type JeditRetainedEvidenceInventoryInput,
  type JeditRetainedEvidenceRef,
  type JeditRetainedEvidenceRole,
  type JeditRetentionObstruction,
} from '../ports/jedit-retained-evidence.js';

export function createJeditRetainedEvidenceInventory(
  input: JeditRetainedEvidenceInventoryInput,
): JeditRetainedEvidenceInventory {
  return {
    refs: [
      packageRef(input),
      receiptRef(input),
      readingEnvelopeRef(input),
      readingPayloadRef(input),
    ],
  };
}

export function missingJeditRetentionMaterial(
  ref: JeditRetainedEvidenceRef,
): JeditRetentionObstruction {
  return {
    code: JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL,
    role: ref.role,
    semanticCoordinate: ref.semanticCoordinate,
  };
}

function packageRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return evidenceRef({
    role: JEDIT_EVIDENCE_ROLE_PACKAGE,
    packageId: input.packageId,
    operationName: 'package-install',
    coordinate: input.packageId,
    byteHash: `package:${input.packageId}`,
  });
}

function receiptRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return evidenceRef({
    role: JEDIT_EVIDENCE_ROLE_RECEIPT,
    packageId: input.packageId,
    operationName: input.mutationOperationName,
    coordinate: input.receiptId,
    byteHash: `receipt:${input.receiptId}`,
  });
}

function readingEnvelopeRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return evidenceRef({
    role: JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
    packageId: input.packageId,
    operationName: input.queryOperationName,
    coordinate: `envelope:${input.readingId}`,
    byteHash: `reading-envelope:${input.readingId}`,
  });
}

function readingPayloadRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return evidenceRef({
    role: JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
    packageId: input.packageId,
    operationName: input.queryOperationName,
    coordinate: `payload:${input.readingId}`,
    byteHash: `reading-payload:${input.readingId}`,
  });
}

interface EvidenceRefInput {
  readonly role: JeditRetainedEvidenceRole;
  readonly packageId: string;
  readonly operationName: string;
  readonly coordinate: string;
  readonly byteHash: string;
}

function evidenceRef(input: EvidenceRefInput): JeditRetainedEvidenceRef {
  return {
    kind: JEDIT_RETAINED_EVIDENCE_REF_KIND,
    role: input.role,
    semanticCoordinate: {
      kind: JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND,
      packageId: input.packageId,
      operationName: input.operationName,
      coordinate: input.coordinate,
    },
    byteIdentity: {
      kind: JEDIT_EVIDENCE_BYTE_IDENTITY_KIND,
      byteHash: input.byteHash,
    },
    posture: JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE,
  };
}
