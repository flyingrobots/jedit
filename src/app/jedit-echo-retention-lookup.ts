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
  JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE,
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
  return inventory.refs.flatMap((ref) => {
    const byteHash = refByteHash(ref);
    return byteHash == null ? [] : [{
      byteHash,
      semanticCoordinate: ref.semanticCoordinate,
      materialBytesHex: toHex(JSON.stringify({
        role: ref.role,
        semanticCoordinate: ref.semanticCoordinate,
      })),
    }];
  });
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
  const byteHash = refByteHash(ref);
  if (byteHash == null) {
    return missingRetainedEvidence(ref);
  }

  const record = retainedMaterialRecord(retainedMaterial, byteHash, ref);
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
  readonly byByteHash: RetainedMaterialByteHashIndex;
}

type RetainedMaterialByteHashIndex =
  ReadonlyMap<string, RetainedMaterialPackageIndex>;
type RetainedMaterialPackageIndex =
  ReadonlyMap<string, RetainedMaterialOperationIndex>;
type RetainedMaterialOperationIndex =
  ReadonlyMap<string, RetainedMaterialCoordinateIndex>;
type RetainedMaterialCoordinateIndex =
  ReadonlyMap<string, JeditEchoRetainedMaterialRecord>;

function indexRetainedMaterial(
  records: readonly JeditEchoRetainedMaterialRecord[],
): RetainedMaterialIndex {
  const byByteHash = new Map<string, Map<string, Map<string, Map<string, JeditEchoRetainedMaterialRecord>>>>();

  for (const record of records) {
    indexRetainedMaterialRecord(byByteHash, record);
  }

  return {
    byByteHash,
  };
}

function indexRetainedMaterialRecord(
  byByteHash: Map<string, Map<string, Map<string, Map<string, JeditEchoRetainedMaterialRecord>>>>,
  record: JeditEchoRetainedMaterialRecord,
): void {
  if (record.semanticCoordinate == null) {
    return;
  }
  let byPackage = byByteHash.get(record.byteHash);
  if (byPackage == null) {
    byPackage = new Map();
    byByteHash.set(record.byteHash, byPackage);
  }
  let byOperation = byPackage.get(record.semanticCoordinate.packageId);
  if (byOperation == null) {
    byOperation = new Map();
    byPackage.set(record.semanticCoordinate.packageId, byOperation);
  }
  let byCoordinate = byOperation.get(record.semanticCoordinate.operationName);
  if (byCoordinate == null) {
    byCoordinate = new Map();
    byOperation.set(record.semanticCoordinate.operationName, byCoordinate);
  }
  byCoordinate.set(record.semanticCoordinate.coordinate, record);
}

function retainedMaterialRecord(
  index: RetainedMaterialIndex,
  byteHash: string,
  ref: JeditRetainedEvidenceRef,
): JeditEchoRetainedMaterialRecord | undefined {
  return index.byByteHash
    .get(byteHash)
    ?.get(ref.semanticCoordinate.packageId)
    ?.get(ref.semanticCoordinate.operationName)
    ?.get(ref.semanticCoordinate.coordinate);
}

function refByteHash(ref: JeditRetainedEvidenceRef): string | undefined {
  return ref.posture === JEDIT_RETAINED_EVIDENCE_PRESENT_INLINE
    ? ref.byteIdentity.byteHash
    : undefined;
}
