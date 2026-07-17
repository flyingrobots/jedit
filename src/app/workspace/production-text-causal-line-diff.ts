import type { CausalLineDiffReading } from '../../ports/text-authority-evidence.js';
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
