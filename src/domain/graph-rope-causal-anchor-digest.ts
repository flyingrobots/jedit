import {
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT,
  GRAPH_ROPE_SCHEMA_VERSION,
  type EchoCausalAnchorFact,
  type EchoCausalAnchorRoot,
  type TextBlobHashPort,
} from './graph-rope-types.js';

const CAUSAL_ANCHOR_DIGEST_PREFIX = 'echo-causal-anchor:v1';
const CAUSAL_ANCHOR_ID_PREFIX = 'causal-anchor:';

export function causalAnchorDigestFor(
  anchor: Omit<EchoCausalAnchorFact, 'anchorDigest' | 'anchorId'>,
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(causalAnchorDigestMaterial(anchor));
}

export function causalAnchorIdForDigest(anchorDigest: string, hash: TextBlobHashPort): string {
  return `${CAUSAL_ANCHOR_ID_PREFIX}${hash.sha256Hex(anchorDigest)}`;
}

export function causalAnchorDigestMaterial(
  anchor: Omit<EchoCausalAnchorFact, 'anchorDigest' | 'anchorId'>,
): string {
  return [
    CAUSAL_ANCHOR_DIGEST_PREFIX,
    `schema=${String(GRAPH_ROPE_SCHEMA_VERSION)}`,
    `subject=${anchor.subject.appId}:${anchor.subject.subjectKind}:${anchor.subject.subjectId}`,
    `frontier=${anchor.basisFrontierDigest}`,
    `purpose=${anchor.purpose}`,
    `retention=${anchor.retention.retentionClass}`,
    `receipt=${anchor.admittedByReceiptId}`,
    `retained=${canonicalRootSet(anchor.retainedRoots).join('|')}`,
    `materialization=${canonicalRootSet(anchor.materializationRoots).join('|')}`,
  ].join('\n');
}

function canonicalRootSet(roots: readonly EchoCausalAnchorRoot[]): readonly string[] {
  return roots.map(canonicalRoot).sort();
}

function canonicalRoot(root: EchoCausalAnchorRoot): string {
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT) {
    return `${root.kind}:${root.role}:${root.id}`;
  }
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT) {
    return `${root.kind}:${root.role}:${root.id}`;
  }
  return `${root.kind}:${root.role}:${root.appId}:${root.subjectKind}:${root.id}`;
}
