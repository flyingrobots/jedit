import { z } from 'zod';

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
} from '../ports/jedit-retained-evidence.js';

const JeditRetainedEvidenceRoleSchema = z.union([
  z.literal(JEDIT_EVIDENCE_ROLE_PACKAGE),
  z.literal(JEDIT_EVIDENCE_ROLE_RECEIPT),
  z.literal(JEDIT_EVIDENCE_ROLE_READING_ENVELOPE),
  z.literal(JEDIT_EVIDENCE_ROLE_READING_PAYLOAD),
]);

const JeditEvidenceSemanticCoordinateSchema = z.object({
  kind: z.literal(JEDIT_EVIDENCE_SEMANTIC_COORDINATE_KIND),
  packageId: z.string(),
  operationName: z.string(),
  coordinate: z.string(),
});

const JeditEvidenceByteIdentitySchema = z.object({
  kind: z.literal(JEDIT_EVIDENCE_BYTE_IDENTITY_KIND),
  byteHash: z.string(),
});

const JeditRetainedEvidencePresentInlineRefSchema = z.object({
  kind: z.literal(JEDIT_RETAINED_EVIDENCE_REF_KIND),
  role: JeditRetainedEvidenceRoleSchema,
  semanticCoordinate: JeditEvidenceSemanticCoordinateSchema,
  byteIdentity: JeditEvidenceByteIdentitySchema,
  posture: z.literal(JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE),
});

const JeditRetainedEvidenceMissingRefSchema = z.object({
  kind: z.literal(JEDIT_RETAINED_EVIDENCE_REF_KIND),
  role: JeditRetainedEvidenceRoleSchema,
  semanticCoordinate: JeditEvidenceSemanticCoordinateSchema,
  posture: z.literal(JEDIT_RETAINED_EVIDENCE_MISSING),
});

export const JeditRetainedEvidenceInventorySchema = z.object({
  refs: z.array(z.union([
    JeditRetainedEvidencePresentInlineRefSchema,
    JeditRetainedEvidenceMissingRefSchema,
  ])),
});
