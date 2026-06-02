import {
  JEDIT_WSC_WORKSPACE_STORE_MISSING_ENVELOPE,
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  JEDIT_WSC_HISTORY_BASIS_LISTED,
  JEDIT_WSC_HISTORY_BASIS_MISSING_BASIS,
  JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED,
  JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE,
  JEDIT_WSC_HISTORY_BASIS_SELECTED,
  JEDIT_WSC_HISTORY_BASIS_STORE_OBSTRUCTED,
  type JeditWscHistoricalBasis,
  type JeditWscHistoryBasisListed,
  type JeditWscHistoryBasisObstructed,
  type JeditWscHistoryBasisSelectionResult,
} from '../ports/jedit-wsc-history-basis.js';

const FIRST_SEQUENCE = 1;

export function listJeditWscHistoricalBases(
  envelopeIds: readonly string[],
): JeditWscHistoryBasisListed {
  return {
    status: JEDIT_WSC_HISTORY_BASIS_LISTED,
    bases: [...envelopeIds].sort().map(historicalBasis),
  };
}

export function selectJeditWscHistoricalBasis(
  store: JeditWscWorkspaceStorePort,
  basisId: string,
): JeditWscHistoryBasisSelectionResult {
  const read = store.readEnvelope(basisId);
  if (read.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return obstructedBasis(basisId, read.obstruction);
  }
  return {
    status: JEDIT_WSC_HISTORY_BASIS_SELECTED,
    basis: historicalBasis(read.envelope.envelopeId, 0),
    envelope: read.envelope,
  };
}

function historicalBasis(envelopeId: string, index: number): JeditWscHistoricalBasis {
  return {
    basisId: envelopeId,
    envelopeId,
    sequence: index + FIRST_SEQUENCE,
    evidencePosture: JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE,
  };
}

function obstructedBasis(
  basisId: string,
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscHistoryBasisObstructed {
  return {
    status: JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED,
    obstruction: {
      code: obstruction.code === JEDIT_WSC_WORKSPACE_STORE_MISSING_ENVELOPE
        ? JEDIT_WSC_HISTORY_BASIS_MISSING_BASIS
        : JEDIT_WSC_HISTORY_BASIS_STORE_OBSTRUCTED,
      message: obstruction.message,
      basisId,
    },
  };
}
