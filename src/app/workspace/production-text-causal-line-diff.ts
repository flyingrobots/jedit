import type {
  CausalLineDiffReading,
  TextBufferSessionPort,
} from '../../ports/text-buffer-session.js';
import type { ProductionTextObstructed } from './production-text-session.js';

export const PRODUCTION_TEXT_CAUSAL_LINE_DIFF_OBSERVED = 'causal-line-diff-observed';

export interface ProductionTextCausalLineDiffRequest {
  readonly bufferId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly maxByteCount: number;
  readonly maxLineCount: number;
  readonly maxRewriteCount: number;
  readonly maxMarkerCount: number;
  readonly atMs: number;
}

export interface ProductionTextCausalLineDiffObserved {
  readonly kind: typeof PRODUCTION_TEXT_CAUSAL_LINE_DIFF_OBSERVED;
  readonly reading: CausalLineDiffReading;
}

export type ProductionTextCausalLineDiffOutcome =
  | ProductionTextCausalLineDiffObserved
  | ProductionTextObstructed;

export interface ProductionTextCausalLineDiffObstructions {
  missingBuffer(atMs: number): ProductionTextObstructed;
  query(atMs: number, message: string): ProductionTextObstructed;
}

export async function observeProductionTextCausalLineDiff(
  session: TextBufferSessionPort,
  request: ProductionTextCausalLineDiffRequest,
  obstructions: ProductionTextCausalLineDiffObstructions,
): Promise<ProductionTextCausalLineDiffOutcome> {
  try {
    const optic = await session.getBufferOptic(request.bufferId);
    if (optic == null) {
      return obstructions.missingBuffer(request.atMs);
    }
    return {
      kind: PRODUCTION_TEXT_CAUSAL_LINE_DIFF_OBSERVED,
      reading: await optic.causalLineDiff({
        basisHeadId: request.basisHeadId,
        nextHeadId: request.nextHeadId,
        maxByteCount: request.maxByteCount,
        maxLineCount: request.maxLineCount,
        maxRewriteCount: request.maxRewriteCount,
        maxMarkerCount: request.maxMarkerCount,
      }),
    };
  } catch (cause) {
    return obstructions.query(
      request.atMs,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}
