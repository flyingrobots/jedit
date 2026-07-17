import { z } from 'zod';
import {
  BufferWorldlineSchema,
  CheckpointKindSchema,
  RewriteKindSchema,
} from '../app/jedit-hot-text-json-schemas.js';
import { HotTextAuthorityBasisSchema } from './hot-text-authority-basis-codec.js';

const BufferRootSchema = z.object({ id: z.number().int(), text: z.string() });
const AdmittedTickSchema = z.object({ id: z.number().int(), rootId: z.number().int() });
const EditGroupSchema = z.object({ id: z.number().int(), tickIds: z.array(z.number().int()) });
const OpenEditGroupSchema = EditGroupSchema;

const SaveCheckpointSchema = z.object({
  id: z.number().int(),
  rootId: z.number().int(),
  path: z.string(),
  authorityCheckpointId: z.string().min(1).optional(),
});

const HotTextBufferStateSchema = z.object({
  path: z.string(),
  authorityBasis: HotTextAuthorityBasisSchema.optional(),
  currentRoot: BufferRootSchema,
  roots: z.array(BufferRootSchema).optional(),
  ticks: z.array(AdmittedTickSchema),
  editGroups: z.array(EditGroupSchema),
  openEditGroup: OpenEditGroupSchema.optional(),
  checkpoints: z.array(SaveCheckpointSchema),
  nextRootId: z.number().int(),
});

const TickMetadataSchema = z.object({
  tickId: z.number().int(),
  kind: RewriteKindSchema,
  author: z.string().optional(),
  baseHeadId: z.string().optional(),
  nextHeadId: z.string().optional(),
  startByte: z.number().int().optional(),
  endByte: z.number().int().optional(),
  insertedByteLength: z.number().int().optional(),
  deletedByteLength: z.number().int().optional(),
  authorityTickId: z.string().min(1).optional(),
  authorityAdmissionId: z.string().min(1).optional(),
  authorityRewriteId: z.string().min(1).optional(),
  authorityDiffId: z.string().min(1).optional(),
  authoritySequenceNumber: z.number().int().positive().optional(),
});

const CheckpointMetadataSchema = z.object({
  checkpointId: z.number().int(),
  authorityCheckpointId: z.string().min(1).optional(),
  authorityHeadId: z.string().min(1).optional(),
  kind: CheckpointKindSchema,
  label: z.string().optional(),
  createdByRopeRewriteId: z.number().int().optional(),
});

export const JeditWorldlineSessionSchema = z.object({
  worldline: BufferWorldlineSchema,
  state: HotTextBufferStateSchema,
  tickMetadata: z.array(TickMetadataSchema),
  checkpointMetadata: z.array(CheckpointMetadataSchema),
});
