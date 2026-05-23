export const JEDIT_RETAINED_EVIDENCE_REF_KIND = 'jedit-retained-evidence-ref';
export const JEDIT_EVIDENCE_BYTE_IDENTITY_KIND = 'byte-identity';
export const JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND = 'semantic-coordinate';
export const JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE = 'PRESENT_INLINE';
export const JEDIT_RETAINED_EVIDENCE_MISSING = 'MISSING';
export const JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL = 'MISSING_RETENTION_MATERIAL';

export const JEDIT_EVIDENCE_ROLE_PACKAGE = 'PACKAGE_IDENTITY';
export const JEDIT_EVIDENCE_ROLE_RECEIPT = 'RECEIPT';
export const JEDIT_EVIDENCE_ROLE_READING_ENVELOPE = 'READING_ENVELOPE';
export const JEDIT_EVIDENCE_ROLE_READING_PAYLOAD = 'READING_PAYLOAD';

export type JeditRetainedEvidenceRole =
  | typeof JEDIT_EVIDENCE_ROLE_PACKAGE
  | typeof JEDIT_EVIDENCE_ROLE_RECEIPT
  | typeof JEDIT_EVIDENCE_ROLE_READING_ENVELOPE
  | typeof JEDIT_EVIDENCE_ROLE_READING_PAYLOAD;

export type JeditRetainedEvidencePosture =
  | typeof JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE
  | typeof JEDIT_RETAINED_EVIDENCE_MISSING;

export interface JeditEvidenceByteIdentity {
  readonly kind: typeof JEDIT_EVIDENCE_BYTE_IDENTITY_KIND;
  readonly byteHash: string;
}

export interface JeditEvidenceSemanticCoordinate {
  readonly kind: typeof JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND;
  readonly packageId: string;
  readonly operationName: string;
  readonly coordinate: string;
}

export interface JeditRetainedEvidenceRef {
  readonly kind: typeof JEDIT_RETAINED_EVIDENCE_REF_KIND;
  readonly role: JeditRetainedEvidenceRole;
  readonly semanticCoordinate: JeditEvidenceSemanticCoordinate;
  readonly byteIdentity?: JeditEvidenceByteIdentity;
  readonly posture: JeditRetainedEvidencePosture;
}

export interface JeditRetentionObstruction {
  readonly code: typeof JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL;
  readonly role: JeditRetainedEvidenceRole;
  readonly semanticCoordinate: JeditEvidenceSemanticCoordinate;
}

export interface JeditRetainedEvidenceInventoryInput {
  readonly packageId: string;
  readonly mutationOperationName: string;
  readonly queryOperationName: string;
  readonly receiptId: string;
  readonly readingId: string;
}

export interface JeditRetainedEvidenceInventory {
  readonly refs: readonly JeditRetainedEvidenceRef[];
}
