import {
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT,
  type EchoCausalAnchorAdmissionRequest,
  type EchoCausalAnchorAdmissionRequestInput,
  type EchoCausalAnchorAppSubjectRoot,
  type EchoCausalAnchorCasObjectRoot,
  type EchoCausalAnchorGraphFactRoot,
  type EchoCausalAnchorRetentionMetadata,
  type EchoCausalAnchorRoot,
  type EchoCausalAnchorSubject,
} from './graph-rope-types.js';

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
