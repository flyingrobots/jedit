import {
  type EchoCausalAnchorAdmissionEvidence,
  type EchoCausalAnchorAdmissionPort,
  type RopeCheckpointAnchorAdmissionRequest,
} from './graph-rope-types.js';

const STRING_TYPE = 'string';
const MIN_ID_LENGTH = 1;

export function requestCheckpointAnchorAdmission(
  port: EchoCausalAnchorAdmissionPort,
  request: RopeCheckpointAnchorAdmissionRequest,
): EchoCausalAnchorAdmissionEvidence | null {
  try {
    const result = port.admitCheckpointAnchor(cloneRequest(request));
    if (result == null || !result.ok || !isUsableEchoEvidence(result.evidence)) {
      return null;
    }
    return result.evidence;
  } catch {
    return null;
  }
}

function cloneRequest(request: RopeCheckpointAnchorAdmissionRequest): RopeCheckpointAnchorAdmissionRequest {
  return {
    checkpointId: request.checkpointId,
    worldlineId: request.worldlineId,
    headId: request.headId,
    reason: request.reason,
    materializationRoots: request.materializationRoots.map((root) => ({
      id: root.id,
      role: root.role,
    })),
  };
}

function isUsableEchoEvidence(
  evidence: EchoCausalAnchorAdmissionEvidence | null | undefined,
): evidence is EchoCausalAnchorAdmissionEvidence {
  return evidence != null
    && isNonEmptyString(evidence.anchorId)
    && isNonEmptyString(evidence.anchorFactId)
    && isNonEmptyString(evidence.receiptId);
}

function isNonEmptyString(value: string): boolean {
  return typeof value === STRING_TYPE && value.length >= MIN_ID_LENGTH;
}
