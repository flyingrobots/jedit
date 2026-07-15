import { z } from 'zod';

export const HotTextWindowByteRangeSchema = z.object({
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
});

const HotTextWindowSupportSchema = z.object({
  leafId: z.string().min(1),
  blobId: z.string().min(1),
  contentHash: z.string().min(1),
  byteRange: HotTextWindowByteRangeSchema,
});

export const HotTextWindowProjectionSchema = z.object({
  basisHeadId: z.string().min(1),
  byteRange: HotTextWindowByteRangeSchema,
  text: z.string(),
  support: z.array(HotTextWindowSupportSchema),
});
