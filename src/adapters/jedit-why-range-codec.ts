import { z } from 'zod';

const WhyRangeOriginSchema = z.object({
  kind: z.enum(['IMPORTED', 'REWRITE', 'UNAVAILABLE']),
  worldlineId: z.string().nullable(),
  initialHeadId: z.string().nullable(),
  createdAtTickId: z.string().nullable(),
  rewriteId: z.string().nullable(),
  diffId: z.string().nullable(),
  textTickReceiptId: z.string().nullable(),
  basisHeadId: z.string().nullable(),
  nextHeadId: z.string().nullable(),
  unavailableCode: z.string().nullable(),
});

const WhyRangeFragmentSchema = z.object({
  coveredStartByte: z.number().int().nonnegative(),
  coveredEndByte: z.number().int().nonnegative(),
  headId: z.string().min(1),
  leafId: z.string().min(1),
  blobId: z.string().min(1),
  origin: WhyRangeOriginSchema,
});

const WhyRangeAnchorAssociationSchema = z.object({
  associationId: z.string().min(1),
  causalAnchorId: z.string().min(1),
  causalAnchorFactId: z.string().min(1),
  causalAnchorReceiptId: z.string().min(1),
});

const WhyRangeCheckpointEvidenceSchema = z.object({
  checkpointId: z.string().min(1),
  headId: z.string().min(1),
  reason: z.string().min(1),
  anchorAssociation: WhyRangeAnchorAssociationSchema.nullable(),
});

export const WhyRangeInputSchema = z.object({
  worldlineId: z.string().min(1),
  basisHeadId: z.string().min(1),
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
  maxFacts: z.number().int().positive(),
  maxDepth: z.number().int().positive(),
  maxHistoricalTextBytes: z.number().int().nonnegative(),
});

export const WhyRangeReadingSchema = z.object({
  worldlineId: z.string().min(1),
  basisHeadId: z.string().min(1),
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
  coverage: z.object({
    kind: z.enum(['COMPLETE', 'PARTIAL']),
    coveredStartByte: z.number().int().nonnegative(),
    coveredEndByte: z.number().int().nonnegative(),
    continuation: z.string().nullable(),
    reason: z.string().nullable(),
  }),
  fragments: z.array(WhyRangeFragmentSchema),
  relatedCheckpoints: z.array(WhyRangeCheckpointEvidenceSchema),
  inspectedFactCount: z.number().int().nonnegative(),
  observerVersion: z.string().min(1),
});
