export {
  JEDIT_EVIDENCE_BYTE_IDENTITY_KIND,
  JEDIT_EVIDENCE_ROLE_PACKAGE,
  JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
  JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
  JEDIT_EVIDENCE_ROLE_RECEIPT,
  JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND,
  JEDIT_RETAINED_EVIDENCE_MISSING,
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
  JEDIT_RETAINED_EVIDENCE_MISSING,
  JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE,
  JEDIT_RETAINED_EVIDENCE_REF_KIND,
  JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL,
  type JeditRetainedEvidenceInventory,
  type JeditRetainedEvidenceInventoryInput,
  type JeditRetainedEvidenceRef,
  type JeditRetainedEvidenceRole,
  type JeditReadingRetainedEvidenceInventoryInput,
  type JeditRetentionObstruction,
} from '../ports/jedit-retained-evidence.js';

const PACKAGE_INSTALL_OPERATION_NAME = 'package-install';
const PACKAGE_BYTE_HASH_PREFIX = 'package:';
const RECEIPT_BYTE_HASH_PREFIX = 'receipt:';
const READING_ENVELOPE_COORDINATE_PREFIX = 'envelope:';
const READING_ENVELOPE_BYTE_HASH_PREFIX = 'reading-envelope:';
const READING_PAYLOAD_COORDINATE_PREFIX = 'payload:';
const READING_PAYLOAD_BYTE_HASH_PREFIX = 'reading-payload:';

export function createJeditRetainedEvidenceInventory(
  input: JeditRetainedEvidenceInventoryInput,
): JeditRetainedEvidenceInventory {
  return {
    refs: [
      packageRef(input),
      receiptRef(input),
      ...readingEvidenceRefs(input),
    ],
  };
}

export function createJeditReadingRetainedEvidenceInventory(
  input: JeditReadingRetainedEvidenceInventoryInput,
): JeditRetainedEvidenceInventory {
  return {
    refs: [
      missingReadingEnvelopeRef(input),
      missingReadingPayloadRef(input),
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
  return presentEvidenceRef({
    role: JEDIT_EVIDENCE_ROLE_PACKAGE,
    packageId: input.packageId,
    operationName: PACKAGE_INSTALL_OPERATION_NAME,
    coordinate: input.packageId,
    byteHash: `${PACKAGE_BYTE_HASH_PREFIX}${input.packageId}`,
  });
}

function receiptRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return presentEvidenceRef({
    role: JEDIT_EVIDENCE_ROLE_RECEIPT,
    packageId: input.packageId,
    operationName: input.mutationOperationName,
    coordinate: input.receiptId,
    byteHash: `${RECEIPT_BYTE_HASH_PREFIX}${input.receiptId}`,
  });
}

function readingEnvelopeRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return presentEvidenceRef({
    role: JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
    packageId: input.packageId,
    operationName: input.queryOperationName,
    coordinate: `${READING_ENVELOPE_COORDINATE_PREFIX}${input.readingId}`,
    byteHash: `${READING_ENVELOPE_BYTE_HASH_PREFIX}${input.readingId}`,
  });
}

function readingPayloadRef(input: JeditRetainedEvidenceInventoryInput): JeditRetainedEvidenceRef {
  return presentEvidenceRef({
    role: JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
    packageId: input.packageId,
    operationName: input.queryOperationName,
    coordinate: `${READING_PAYLOAD_COORDINATE_PREFIX}${input.readingId}`,
    byteHash: `${READING_PAYLOAD_BYTE_HASH_PREFIX}${input.readingId}`,
  });
}

function readingEvidenceRefs(
  input: JeditRetainedEvidenceInventoryInput,
): readonly JeditRetainedEvidenceRef[] {
  if (input.readingEvidence != null) {
    return input.readingEvidence.refs.filter(isReadingEvidenceRef);
  }
  return [
    readingEnvelopeRef(input),
    readingPayloadRef(input),
  ];
}

function isReadingEvidenceRef(ref: JeditRetainedEvidenceRef): boolean {
  return ref.role === JEDIT_EVIDENCE_ROLE_READING_ENVELOPE
    || ref.role === JEDIT_EVIDENCE_ROLE_READING_PAYLOAD;
}

function missingReadingEnvelopeRef(
  input: JeditReadingRetainedEvidenceInventoryInput,
): JeditRetainedEvidenceRef {
  return missingEvidenceRef({
    role: JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
    packageId: input.packageId,
    operationName: input.queryOperationName,
    coordinate: `${READING_ENVELOPE_COORDINATE_PREFIX}${input.readingId}`,
  });
}

function missingReadingPayloadRef(
  input: JeditReadingRetainedEvidenceInventoryInput,
): JeditRetainedEvidenceRef {
  return missingEvidenceRef({
    role: JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
    packageId: input.packageId,
    operationName: input.queryOperationName,
    coordinate: `${READING_PAYLOAD_COORDINATE_PREFIX}${input.readingId}`,
  });
}

interface EvidenceRefInput {
  readonly role: JeditRetainedEvidenceRole;
  readonly packageId: string;
  readonly operationName: string;
  readonly coordinate: string;
}

interface PresentEvidenceRefInput extends EvidenceRefInput {
  readonly byteHash: string;
}

function presentEvidenceRef(input: PresentEvidenceRefInput): JeditRetainedEvidenceRef {
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

function missingEvidenceRef(input: EvidenceRefInput): JeditRetainedEvidenceRef {
  return {
    kind: JEDIT_RETAINED_EVIDENCE_REF_KIND,
    role: input.role,
    semanticCoordinate: {
      kind: JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND,
      packageId: input.packageId,
      operationName: input.operationName,
      coordinate: input.coordinate,
    },
    posture: JEDIT_RETAINED_EVIDENCE_MISSING,
  };
}
