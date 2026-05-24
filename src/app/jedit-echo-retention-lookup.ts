export {
  JEDIT_ECHO_RETENTION_LOOKUP_HIT,
  JEDIT_ECHO_RETENTION_LOOKUP_MISSING,
} from '../ports/jedit-echo-retention-lookup.js';
import { missingJeditRetentionMaterial } from './jedit-retained-evidence.js';
import type { JeditRetainedEvidenceRef } from '../ports/jedit-retained-evidence.js';
import {
  JEDIT_ECHO_RETENTION_LOOKUP_HIT,
  JEDIT_ECHO_RETENTION_LOOKUP_MISSING,
  type JeditEchoRetainedMaterialRecord,
  type JeditEchoRetentionLookupHit,
  type JeditEchoRetentionLookupMissing,
  type JeditEchoRetentionLookupPort,
  type JeditEchoRetentionLookupResult,
} from '../ports/jedit-echo-retention-lookup.js';

export function createInMemoryJeditEchoRetentionLookupPort(
  records: readonly JeditEchoRetainedMaterialRecord[],
): JeditEchoRetentionLookupPort {
  const retainedMaterial = new Map(records.map((record) => [
    record.byteHash,
    record.materialBytesHex,
  ]));

  return {
    lookupRetainedEvidence(ref) {
      return lookupRetainedEvidence(retainedMaterial, ref);
    },
  };
}

export function lookupJeditRetainedEvidenceMaterial(
  port: JeditEchoRetentionLookupPort,
  ref: JeditRetainedEvidenceRef,
): JeditEchoRetentionLookupResult {
  return port.lookupRetainedEvidence(ref);
}

function lookupRetainedEvidence(
  retainedMaterial: ReadonlyMap<string, string>,
  ref: JeditRetainedEvidenceRef,
): JeditEchoRetentionLookupResult {
  const byteHash = ref.byteIdentity?.byteHash;
  if (byteHash == null) {
    return missingRetainedEvidence(ref);
  }

  const materialBytesHex = retainedMaterial.get(byteHash);
  return materialBytesHex == null
    ? missingRetainedEvidence(ref)
    : retainedEvidenceHit(ref, materialBytesHex);
}

function retainedEvidenceHit(
  ref: JeditRetainedEvidenceRef,
  materialBytesHex: string,
): JeditEchoRetentionLookupHit {
  return {
    status: JEDIT_ECHO_RETENTION_LOOKUP_HIT,
    ref,
    materialBytesHex,
  };
}

function missingRetainedEvidence(
  ref: JeditRetainedEvidenceRef,
): JeditEchoRetentionLookupMissing {
  return {
    status: JEDIT_ECHO_RETENTION_LOOKUP_MISSING,
    ref,
    obstruction: missingJeditRetentionMaterial(ref),
  };
}
