import { z } from 'zod';

export const HotTextAuthorityBasisSchema = z.object({
  worldlineId: z.string().min(1), headId: z.string().min(1), rootNodeId: z.string().min(1),
  createdByTickId: z.string().min(1), contentHash: z.string().min(1),
  byteLength: z.number().int().nonnegative(),
  lineCount: z.number().int().positive(),
});
