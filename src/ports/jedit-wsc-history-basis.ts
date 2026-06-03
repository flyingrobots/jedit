import type { JeditWscWorkspaceEnvelope } from './jedit-wsc-workspace-store.js';

export const JEDIT_WSC_HISTORY_BASIS_LISTED = 'JEDIT_WSC_HISTORY_BASIS_LISTED';
export const JEDIT_WSC_HISTORY_BASIS_SELECTED = 'JEDIT_WSC_HISTORY_BASIS_SELECTED';
export const JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED = 'JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED';
export const JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE = 'retained_wsc_envelope';
export const JEDIT_WSC_HISTORY_BASIS_MISSING_BASIS = 'missing_basis';
export const JEDIT_WSC_HISTORY_BASIS_STORE_OBSTRUCTED = 'wsc_store_obstructed';

export interface JeditWscHistoricalBasis {
  readonly basisId: string;
  readonly envelopeId: string;
  readonly sequence: number;
  readonly evidencePosture: typeof JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE;
}

export interface JeditWscHistoryBasisListed {
  readonly status: typeof JEDIT_WSC_HISTORY_BASIS_LISTED;
  readonly bases: readonly JeditWscHistoricalBasis[];
}

export interface JeditWscHistoryBasisSelected {
  readonly status: typeof JEDIT_WSC_HISTORY_BASIS_SELECTED;
  readonly basis: JeditWscHistoricalBasis;
  readonly envelope: JeditWscWorkspaceEnvelope;
}

export interface JeditWscHistoryBasisObstruction {
  readonly code: string;
  readonly message: string;
  readonly basisId?: string;
}

export interface JeditWscHistoryBasisObstructed {
  readonly status: typeof JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED;
  readonly obstruction: JeditWscHistoryBasisObstruction;
}

export type JeditWscHistoryBasisListResult = JeditWscHistoryBasisListed;

export type JeditWscHistoryBasisSelectionResult =
  | JeditWscHistoryBasisSelected
  | JeditWscHistoryBasisObstructed;
