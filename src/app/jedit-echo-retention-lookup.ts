export {
  JEDIT_ECHO_RETENTION_LOOKUP_HIT,
  JEDIT_ECHO_RETENTION_LOOKUP_MISSING,
} from '../ports/jedit-echo-retention-lookup.js';
import { missingJeditRetentionMaterial } from './jedit-retained-evidence.js';
import type {
  JeditRetainedEvidenceInventory,
  JeditRetainedEvidenceRef,
} from '../ports/jedit-retained-evidence.js';
import {
  JEDIT_ECHO_RETENTION_LOOKUP_HIT,
  JEDIT_ECHO_RETENTION_LOOKUP_MISSING,
  type JeditEchoRetainedMaterialRecord,
  type JeditEchoRetentionLookupHit,
  type JeditEchoRetentionLookupMissing,
  type JeditEchoRetentionLookupPort,
  type JeditEchoRetentionLookupResult,
} from '../ports/jedit-echo-retention-lookup.js';

const UTF8_ENCODER = new TextEncoder();

export function createInMemoryJeditEchoRetentionLookupPort(
  records: readonly JeditEchoRetainedMaterialRecord[],
): JeditEchoRetentionLookupPort {
  const retainedMaterial = indexRetainedMaterial(records);

  return {
    lookupRetainedEvidence(ref) {
      return lookupRetainedEvidence(retainedMaterial, ref);
    },
  };
}

export function createJeditEchoRetainedMaterialRecords(
  inventory: JeditRetainedEvidenceInventory,
): readonly JeditEchoRetainedMaterialRecord[] {
  return inventory.refs.flatMap((ref) => (
    ref.byteIdentity == null ? [] : [{
      byteHash: ref.byteIdentity.byteHash,
      semanticCoordinate: ref.semanticCoordinate,
      materialBytesHex: toHex(JSON.stringify({
        role: ref.role,
        semanticCoordinate: ref.semanticCoordinate,
      })),
    }]
  ));
}

export function lookupJeditRetainedEvidenceMaterial(
  port: JeditEchoRetentionLookupPort,
  ref: JeditRetainedEvidenceRef,
): JeditEchoRetentionLookupResult {
  return port.lookupRetainedEvidence(ref);
}

function lookupRetainedEvidence(
  retainedMaterial: RetainedMaterialIndex,
  ref: JeditRetainedEvidenceRef,
): JeditEchoRetentionLookupResult {
  const byteHash = ref.byteIdentity?.byteHash;
  if (byteHash == null) {
    return missingRetainedEvidence(ref);
  }

  const record = retainedMaterial.bySemanticCoordinate.get(retainedMaterialKey(byteHash, ref));
  if (record == null) {
    return missingRetainedEvidence(ref);
  }

  return retainedEvidenceHit(ref, record.materialBytesHex);
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

function toHex(value: string): string {
  return Array.from(UTF8_ENCODER.encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface RetainedMaterialIndex {
  readonly bySemanticCoordinate: ReadonlyMap<string, JeditEchoRetainedMaterialRecord>;
}

function indexRetainedMaterial(
  records: readonly JeditEchoRetainedMaterialRecord[],
): RetainedMaterialIndex {
  const bySemanticCoordinate = new Map<string, JeditEchoRetainedMaterialRecord>();

  for (const record of records) {
    bySemanticCoordinate.set(retainedMaterialRecordKey(record), record);
  }

  return {
    bySemanticCoordinate,
  };
}

function retainedMaterialRecordKey(record: JeditEchoRetainedMaterialRecord): string {
  return JSON.stringify([record.byteHash, record.semanticCoordinate]);
}

function retainedMaterialKey(
  byteHash: string,
  ref: JeditRetainedEvidenceRef,
): string {
  return JSON.stringify([byteHash, ref.semanticCoordinate]);
}
