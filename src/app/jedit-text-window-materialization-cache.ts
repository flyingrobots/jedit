import {
  textByteRangesEqual,
} from '../domain/graph-rope-coordinates.js';
import {
  BYTE_OFFSET_COORDINATE_KIND,
  type TextByteRange,
} from '../domain/graph-rope-types.js';
import type { HashPort } from '../ports/hash.js';
import type { HotTextWindowProjection } from '../ports/text-window-projection.js';
import {
  JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
  JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
  JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION,
  type JeditTextWindowMaterialization,
  type JeditTextWindowMaterializationKey,
  type JeditTextWindowMaterializationProvenance,
} from '../ports/jedit-text-window-materialization.js';

export type {
  JeditTextWindowMaterialization,
  JeditTextWindowMaterializationKey,
  JeditTextWindowMaterializationProvenance,
} from '../ports/jedit-text-window-materialization.js';

export const JEDIT_MATERIALIZATION_CACHE_HIT = 'hit';
export const JEDIT_MATERIALIZATION_CACHE_MISS = 'miss';
export const JEDIT_MATERIALIZATION_CACHE_STALE = 'stale';
export const JEDIT_MATERIALIZATION_CACHE_KEY_MISMATCH = 'materialization-cache-key-mismatch';
export const JEDIT_MATERIALIZATION_CACHE_PROJECTION_MISMATCH = 'materialization-cache-projection-mismatch';
export const DEFAULT_JEDIT_MATERIALIZATION_CACHE_ENTRY_LIMIT = 32;
const JEDIT_MATERIALIZATION_CACHE_KEY_DOMAIN = 'jedit.text-window.materialization-cache-key.v1';
const JEDIT_MATERIALIZATION_COORDINATE_DOMAIN = 'jedit.text-window.materialization-coordinate.v1';
const ZERO_VALUE = 0;
const ONE_VALUE = 1;
const UTF8_ENCODER = new TextEncoder();
const MATERIALIZATION_POLICY = Object.freeze({
  authority: 'disposable-projection',
  basis: 'requested-jim-rope-head',
  completeness: JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
  coverage: 'exact-utf8-byte-range',
  frontier: 'request-namespace-not-echo-evidence',
  support: 'contained-in-projection-range',
});

export interface CreateJeditTextWindowMaterializationKeyInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly requestFrontierRef: string;
  readonly coverage: TextByteRange;
  readonly observerPlanId: string;
}

export interface JeditTextWindowMaterializationCacheMetrics {
  readonly entryCount: number;
  readonly materializedProjectionBytes: number;
}

export type JeditTextWindowMaterializationCacheLookup =
  | { readonly status: typeof JEDIT_MATERIALIZATION_CACHE_HIT; readonly entry: JeditTextWindowMaterialization }
  | { readonly status: typeof JEDIT_MATERIALIZATION_CACHE_MISS }
  | {
      readonly status: typeof JEDIT_MATERIALIZATION_CACHE_STALE;
      readonly code:
        | typeof JEDIT_MATERIALIZATION_CACHE_KEY_MISMATCH
        | typeof JEDIT_MATERIALIZATION_CACHE_PROJECTION_MISMATCH;
    };

export interface DisposableJeditTextWindowMaterializationCache {
  lookup(key: JeditTextWindowMaterializationKey): JeditTextWindowMaterializationCacheLookup;
  retain(entry: JeditTextWindowMaterialization): void;
  delete(coordinateDigest: string): void;
  clear(): void;
  metrics(): JeditTextWindowMaterializationCacheMetrics;
}

export class JeditTextWindowMaterializationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JeditTextWindowMaterializationError';
  }
}

export function createJeditTextWindowMaterializationKey(
  input: CreateJeditTextWindowMaterializationKeyInput,
  hash: HashPort,
): JeditTextWindowMaterializationKey {
  assertKeyInput(input);
  const policyDigest = hash.sha256Hex(JSON.stringify(MATERIALIZATION_POLICY));
  const coordinate = serializedCoordinate(input);
  const coordinateDigest = hash.sha256Hex(JSON.stringify({
    domain: JEDIT_MATERIALIZATION_COORDINATE_DOMAIN,
    coordinate,
  }));
  const keyWithoutDigest: Omit<JeditTextWindowMaterializationKey, 'cacheKeyDigest'> = {
    schemaVersion: JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
    materializerVersion: JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION,
    basis: Object.freeze({
      worldlineId: input.worldlineId,
      headId: input.headId,
      requestFrontierRef: input.requestFrontierRef,
    }),
    coverage: cloneTextByteRange(input.coverage),
    observerPlanId: input.observerPlanId,
    policyDigest,
    coordinateDigest,
  };
  return Object.freeze({
    ...keyWithoutDigest,
    cacheKeyDigest: hash.sha256Hex(JSON.stringify({
      domain: JEDIT_MATERIALIZATION_CACHE_KEY_DOMAIN,
      key: serializedKey(keyWithoutDigest),
    })),
  });
}

export function createJeditTextWindowMaterialization(
  key: JeditTextWindowMaterializationKey,
  projection: HotTextWindowProjection,
): JeditTextWindowMaterialization {
  if (!projectionMatchesKey(projection, key)) {
    throw new JeditTextWindowMaterializationError('Materialized projection does not match its cache key.');
  }
  const materializedProjectionBytes = UTF8_ENCODER.encode(projection.text).length;
  if (materializedProjectionBytes !== byteRangeLength(key.coverage)) {
    throw new JeditTextWindowMaterializationError('Materialized projection bytes do not cover the cache key range.');
  }
  return Object.freeze({
    key: cloneMaterializationKey(key),
    completeness: JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
    materializedProjectionBytes,
    projection: cloneProjection(projection),
  });
}

export function jeditTextWindowMaterializationProvenance(
  entry: JeditTextWindowMaterialization,
): JeditTextWindowMaterializationProvenance {
  return Object.freeze({
    key: entry.key,
    completeness: entry.completeness,
    materializedProjectionBytes: entry.materializedProjectionBytes,
  });
}

export function createDisposableJeditTextWindowMaterializationCache(
  entryLimit: number = DEFAULT_JEDIT_MATERIALIZATION_CACHE_ENTRY_LIMIT,
): DisposableJeditTextWindowMaterializationCache {
  if (!Number.isInteger(entryLimit) || entryLimit < ONE_VALUE) {
    throw new JeditTextWindowMaterializationError('Materialization cache entry limit must be a positive integer.');
  }
  const entries = new Map<string, JeditTextWindowMaterialization>();
  const cache: DisposableJeditTextWindowMaterializationCache = {
    lookup(key) {
      return lookupEntry(entries, key);
    },
    retain(entry) {
      retainEntry(entries, entry, entryLimit);
    },
    delete(coordinateDigest) {
      entries.delete(coordinateDigest);
    },
    clear() {
      entries.clear();
    },
    metrics() {
      return cacheMetrics(entries);
    },
  };
  return Object.freeze(cache);
}

function lookupEntry(
  entries: Map<string, JeditTextWindowMaterialization>,
  key: JeditTextWindowMaterializationKey,
): JeditTextWindowMaterializationCacheLookup {
  const entry = entries.get(key.coordinateDigest);
  if (entry == null) {
    return { status: JEDIT_MATERIALIZATION_CACHE_MISS };
  }
  if (!materializationKeysEqual(entry.key, key)) {
    entries.delete(key.coordinateDigest);
    return { status: JEDIT_MATERIALIZATION_CACHE_STALE, code: JEDIT_MATERIALIZATION_CACHE_KEY_MISMATCH };
  }
  if (!materializationMatchesProjection(entry)) {
    entries.delete(key.coordinateDigest);
    return { status: JEDIT_MATERIALIZATION_CACHE_STALE, code: JEDIT_MATERIALIZATION_CACHE_PROJECTION_MISMATCH };
  }
  entries.delete(key.coordinateDigest);
  entries.set(key.coordinateDigest, entry);
  return { status: JEDIT_MATERIALIZATION_CACHE_HIT, entry };
}

function retainEntry(
  entries: Map<string, JeditTextWindowMaterialization>,
  entry: JeditTextWindowMaterialization,
  entryLimit: number,
): void {
  if (!materializationEntryInternallyConsistent(entry)) {
    throw new JeditTextWindowMaterializationError('Materialization cache entry has stale projection metadata.');
  }
  entries.delete(entry.key.coordinateDigest);
  entries.set(entry.key.coordinateDigest, entry);
  while (entries.size > entryLimit) {
    const oldest = entries.keys().next();
    if (oldest.done) {
      return;
    }
    entries.delete(oldest.value);
  }
}

function materializationMatchesProjection(entry: JeditTextWindowMaterialization): boolean {
  return jeditTextWindowMaterializationProvenanceMatchesProjection(entry, entry.projection);
}

function materializationEntryInternallyConsistent(
  entry: JeditTextWindowMaterialization,
): boolean {
  return entry.completeness === JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE
    && entry.materializedProjectionBytes === UTF8_ENCODER.encode(entry.projection.text).length
    && entry.materializedProjectionBytes === byteRangeLength(entry.key.coverage)
    && projectionMatchesKey(entry.projection, entry.key);
}

export function jeditTextWindowMaterializationProvenanceMatchesProjection(
  provenance: JeditTextWindowMaterializationProvenance | undefined,
  projection: HotTextWindowProjection,
): boolean {
  return provenance != null
    && materializationKeyIsCurrent(provenance.key)
    && provenance.completeness === JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE
    && provenance.materializedProjectionBytes === UTF8_ENCODER.encode(projection.text).length
    && provenance.materializedProjectionBytes === byteRangeLength(provenance.key.coverage)
    && projectionMatchesKey(projection, provenance.key);
}

function materializationKeyIsCurrent(key: JeditTextWindowMaterializationKey): boolean {
  return key.schemaVersion === JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION
    && key.materializerVersion === JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION
    && key.observerPlanId.length > ZERO_VALUE
    && key.policyDigest.length > ZERO_VALUE
    && key.coordinateDigest.length > ZERO_VALUE
    && key.cacheKeyDigest.length > ZERO_VALUE;
}

function projectionMatchesKey(
  projection: HotTextWindowProjection,
  key: JeditTextWindowMaterializationKey,
): boolean {
  return projection.basisHeadId === key.basis.headId
    && projection.basis.worldlineId === key.basis.worldlineId
    && projection.basis.headId === key.basis.headId
    && projection.byteRange.startByte === key.coverage.startByte.value
    && projection.byteRange.endByte === key.coverage.endByte.value;
}

function materializationKeysEqual(
  left: JeditTextWindowMaterializationKey,
  right: JeditTextWindowMaterializationKey,
): boolean {
  return cacheIdentityEqual(left, right)
    && basisCoordinateEqual(left, right)
    && textByteRangesEqual(left.coverage, right.coverage);
}

function cacheIdentityEqual(
  left: JeditTextWindowMaterializationKey,
  right: JeditTextWindowMaterializationKey,
): boolean {
  return left.cacheKeyDigest === right.cacheKeyDigest
    && left.coordinateDigest === right.coordinateDigest
    && left.schemaVersion === right.schemaVersion
    && left.materializerVersion === right.materializerVersion
    && left.observerPlanId === right.observerPlanId
    && left.policyDigest === right.policyDigest;
}

function basisCoordinateEqual(
  left: JeditTextWindowMaterializationKey,
  right: JeditTextWindowMaterializationKey,
): boolean {
  return left.basis.worldlineId === right.basis.worldlineId
    && left.basis.headId === right.basis.headId
    && left.basis.requestFrontierRef === right.basis.requestFrontierRef;
}

function cacheMetrics(
  entries: ReadonlyMap<string, JeditTextWindowMaterialization>,
): JeditTextWindowMaterializationCacheMetrics {
  let materializedProjectionBytes = ZERO_VALUE;
  for (const entry of entries.values()) {
    materializedProjectionBytes += entry.materializedProjectionBytes;
  }
  return Object.freeze({ entryCount: entries.size, materializedProjectionBytes });
}

function assertKeyInput(input: CreateJeditTextWindowMaterializationKeyInput): void {
  if (!keyStringsAreValid(input) || !coverageIsValid(input.coverage)) {
    throw new JeditTextWindowMaterializationError('Materialization cache key input is invalid.');
  }
}

function keyStringsAreValid(input: CreateJeditTextWindowMaterializationKeyInput): boolean {
  return input.worldlineId.length > ZERO_VALUE
    && input.headId.length > ZERO_VALUE
    && input.requestFrontierRef.length > ZERO_VALUE
    && input.observerPlanId.length > ZERO_VALUE;
}

function coverageIsValid(coverage: TextByteRange): boolean {
  return coverage.startByte.kind === BYTE_OFFSET_COORDINATE_KIND
    && coverage.endByte.kind === BYTE_OFFSET_COORDINATE_KIND
    && Number.isInteger(coverage.startByte.value)
    && Number.isInteger(coverage.endByte.value)
    && coverage.startByte.value >= ZERO_VALUE
    && coverage.startByte.value <= coverage.endByte.value;
}

function serializedCoordinate(input: CreateJeditTextWindowMaterializationKeyInput) {
  return {
    worldlineId: input.worldlineId,
    headId: input.headId,
    requestFrontierRef: input.requestFrontierRef,
    coverage: serializedCoverage(input.coverage),
  };
}

function serializedKey(key: Omit<JeditTextWindowMaterializationKey, 'cacheKeyDigest'>) {
  return {
    schemaVersion: key.schemaVersion,
    materializerVersion: key.materializerVersion,
    basis: key.basis,
    coverage: serializedCoverage(key.coverage),
    observerPlanId: key.observerPlanId,
    policyDigest: key.policyDigest,
    coordinateDigest: key.coordinateDigest,
  };
}

function serializedCoverage(range: TextByteRange) {
  return {
    startByte: range.startByte.value,
    endByte: range.endByte.value,
  };
}

function byteRangeLength(range: TextByteRange): number {
  return range.endByte.value - range.startByte.value;
}

function cloneProjection(projection: HotTextWindowProjection): HotTextWindowProjection {
  return Object.freeze({
    ...projection,
    basis: Object.freeze({ ...projection.basis }),
    byteRange: Object.freeze({ ...projection.byteRange }),
    support: Object.freeze(projection.support.map((support) => Object.freeze({
      ...support,
      byteRange: Object.freeze({ ...support.byteRange }),
    }))),
  });
}

function cloneMaterializationKey(
  key: JeditTextWindowMaterializationKey,
): JeditTextWindowMaterializationKey {
  return Object.freeze({
    ...key,
    basis: Object.freeze({ ...key.basis }),
    coverage: cloneTextByteRange(key.coverage),
  });
}

function cloneTextByteRange(range: TextByteRange): TextByteRange {
  return Object.freeze({
    startByte: Object.freeze({ ...range.startByte }),
    endByte: Object.freeze({ ...range.endByte }),
  });
}
