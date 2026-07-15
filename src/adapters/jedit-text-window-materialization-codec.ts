import { z } from 'zod';
import { BYTE_OFFSET_COORDINATE_KIND } from '../domain/graph-rope-types.js';
import {
  JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
  JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
} from '../ports/jedit-text-window-materialization.js';

const ByteOffsetSchema = z.object({
  kind: z.literal(BYTE_OFFSET_COORDINATE_KIND),
  value: z.number().int().nonnegative(),
});

const TextByteRangeSchema = z.object({
  startByte: ByteOffsetSchema,
  endByte: ByteOffsetSchema,
}).refine(
  (range) => range.startByte.value <= range.endByte.value,
  { message: 'materialization coverage start must not exceed end' },
);

const JeditTextWindowMaterializationBasisSchema = z.object({
  worldlineId: z.string().min(1),
  headId: z.string().min(1),
  requestFrontierRef: z.string().min(1),
});

export const JeditTextWindowMaterializationKeySchema = z.object({
  schemaVersion: z.literal(JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION),
  materializerVersion: z.string().min(1),
  basis: JeditTextWindowMaterializationBasisSchema,
  coverage: TextByteRangeSchema,
  observerPlanId: z.string().min(1),
  policyDigest: z.string().min(1),
  coordinateDigest: z.string().min(1),
  cacheKeyDigest: z.string().min(1),
});

export const JeditTextWindowMaterializationProvenanceSchema = z.object({
  key: JeditTextWindowMaterializationKeySchema,
  completeness: z.literal(JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE),
  materializedProjectionBytes: z.number().int().nonnegative(),
});
