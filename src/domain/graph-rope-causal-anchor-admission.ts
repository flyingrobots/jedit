import {
  ECHO_CAUSAL_ANCHOR_ADMISSION_AUTHORITY_ECHO,
  ECHO_CAUSAL_ANCHOR_FACT_KIND,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT,
  GRAPH_ROPE_SCHEMA_VERSION,
  type EchoCausalAnchorAdmissionPort,
  type EchoCausalAnchorAdmissionRequest,
  type EchoCausalAnchorAdmissionRequestInput,
  type EchoCausalAnchorAdmissionResult,
  type EchoCausalAnchorAppSubjectRoot,
  type EchoCausalAnchorCasObjectRoot,
  type EchoCausalAnchorFact,
  type EchoCausalAnchorGraphFactRoot,
  type EchoCausalAnchorRetentionMetadata,
  type EchoCausalAnchorRoot,
  type EchoCausalAnchorSubject,
  type TextBlobHashPort,
} from './graph-rope-types.js';
import {
  causalAnchorDigestFor,
  causalAnchorIdForDigest,
} from './graph-rope-causal-anchor-digest.js';

const RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT = 'causal-anchor-receipt:';

export interface CreateDeterministicEchoCausalAnchorAdmissionPortInput {
  readonly hash: TextBlobHashPort;
}

export function makeEchoCausalAnchorAdmissionRequest(
  input: EchoCausalAnchorAdmissionRequestInput,
): EchoCausalAnchorAdmissionRequest {
  return {
    subject: cloneAnchorSubject(input.subject),
    basisFrontierDigest: input.basisFrontierDigest,
    retainedRoots: input.retainedRoots.map(cloneAnchorRoot),
    materializationRoots: (input.materializationRoots ?? []).map(cloneAnchorRoot),
    purpose: input.purpose,
    retention: cloneRetentionMetadata(input.retention),
  };
}

export function createDeterministicEchoCausalAnchorAdmissionPort(
  input: CreateDeterministicEchoCausalAnchorAdmissionPortInput,
): EchoCausalAnchorAdmissionPort {
  let nextAdmissionSequence = 1;

  return {
    admitCausalAnchor(request) {
      const sequence = nextAdmissionSequence;
      nextAdmissionSequence += 1;
      return admitCausalAnchor(request, input.hash, sequence);
    },
  };
}

function admitCausalAnchor(
  request: EchoCausalAnchorAdmissionRequest,
  hash: TextBlobHashPort,
  sequence: number,
): EchoCausalAnchorAdmissionResult {
  const admittedByReceiptId = anchorReceiptIdFor(request, sequence, hash);
  const anchorBasis: Omit<EchoCausalAnchorFact, 'anchorDigest' | 'anchorId'> = {
    kind: ECHO_CAUSAL_ANCHOR_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    subject: cloneAnchorSubject(request.subject),
    basisFrontierDigest: request.basisFrontierDigest,
    retainedRoots: request.retainedRoots.map(cloneAnchorRoot),
    materializationRoots: request.materializationRoots.map(cloneAnchorRoot),
    purpose: request.purpose,
    retention: cloneRetentionMetadata(request.retention),
    admittedByReceiptId,
  };
  const anchorDigest = causalAnchorDigestFor(anchorBasis, hash);
  const anchorId = causalAnchorIdForDigest(anchorDigest, hash);
  return {
    anchor: {
      ...anchorBasis,
      anchorId,
      anchorDigest,
    },
    receipt: {
      authority: ECHO_CAUSAL_ANCHOR_ADMISSION_AUTHORITY_ECHO,
      receiptId: admittedByReceiptId,
      anchorId,
    },
  };
}

function anchorReceiptIdFor(
  request: EchoCausalAnchorAdmissionRequest,
  sequence: number,
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex([
    RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT,
    request.subject.appId,
    request.subject.subjectKind,
    request.subject.subjectId,
    request.basisFrontierDigest,
    request.purpose,
    request.retention.retentionClass,
    String(sequence),
  ].join(':'));
}

function cloneAnchorSubject(subject: EchoCausalAnchorSubject): EchoCausalAnchorSubject {
  return {
    appId: subject.appId,
    subjectKind: subject.subjectKind,
    subjectId: subject.subjectId,
  };
}

function cloneRetentionMetadata(retention: EchoCausalAnchorRetentionMetadata): EchoCausalAnchorRetentionMetadata {
  return {
    retentionClass: retention.retentionClass,
  };
}

function cloneAnchorRoot(root: EchoCausalAnchorRoot): EchoCausalAnchorRoot {
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT) {
    return cloneCasObjectRoot(root);
  }
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT) {
    return cloneGraphFactRoot(root);
  }
  return cloneAppSubjectRoot(root);
}

function cloneCasObjectRoot(root: EchoCausalAnchorCasObjectRoot): EchoCausalAnchorCasObjectRoot {
  return {
    kind: root.kind,
    id: root.id,
    role: root.role,
  };
}

function cloneGraphFactRoot(root: EchoCausalAnchorGraphFactRoot): EchoCausalAnchorGraphFactRoot {
  return {
    kind: root.kind,
    id: root.id,
    role: root.role,
  };
}

function cloneAppSubjectRoot(root: EchoCausalAnchorAppSubjectRoot): EchoCausalAnchorAppSubjectRoot {
  return {
    kind: root.kind,
    appId: root.appId,
    subjectKind: root.subjectKind,
    id: root.id,
    role: root.role,
  };
}
