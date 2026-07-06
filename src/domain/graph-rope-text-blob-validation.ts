import {
  CONTENT_ADDRESSED_BLOB_STORE_KIND,
  FACT_VALIDATION_ERROR_HASH_MISMATCH,
  FACT_VALIDATION_ERROR_INVALID_ID,
  FACT_VALIDATION_ERROR_INVALID_KIND,
  FACT_VALIDATION_ERROR_INVALID_METRIC,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  FACT_VALIDATION_ERROR_INVALID_UTF8,
  GRAPH_ROPE_SCHEMA_VERSION,
  INLINE_UTF8_BYTES_STORAGE_KIND,
  TEXT_BLOB_ENCODING_UTF8,
  TEXT_BLOB_FACT_KIND,
  TEXT_BLOB_STORE_ID,
  type FactValidationErrorCode,
  type FactValidationResult,
  type InlineTextBlobStorage,
  type MakeStoredTextBlobFactInput,
  type MakeTextBlobFactInput,
  type MakeTextBlobFactResult,
  type RopeAdmittedFact,
  type RopeFactValidationContext,
  type StoredTextBlobStorage,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextBlobStorage,
} from './graph-rope-types.js';

const MIN_ID_LENGTH = 1;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const GRAPH_ROPE_HASH_MATERIAL_PREFIX = 'utf8:';
const TEXT_BLOB_ID_PREFIX = 'text-blob:';
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

export function makeTextBlobFact(input: MakeTextBlobFactInput): MakeTextBlobFactResult {
  if (!isValidUtf8(input.bytes)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_UTF8);
  }
  return validFact(textBlobFactForBytes(input.bytes, inlineStorageForBytes(input.bytes), input.hash));
}

export function makeStoredTextBlobFact(input: MakeStoredTextBlobFactInput): MakeTextBlobFactResult {
  if (input.contentRef.length < MIN_ID_LENGTH) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_ID);
  }
  if (!isValidUtf8(input.bytes)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_UTF8);
  }
  return validFact(textBlobFactForBytes(input.bytes, storedStorageForRef(input.contentRef), input.hash));
}

export function validateTextBlobFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== TEXT_BLOB_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  const bytes = textBlobBytes(fact, context);
  if (bytes === null) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  return validateTextBlobBytes(fact, bytes, context.hash);
}

function validateTextBlobBytes(
  fact: TextBlobFact,
  bytes: Uint8Array,
  hash: TextBlobHashPort,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.encoding !== TEXT_BLOB_ENCODING_UTF8 || !isValidUtf8(bytes)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_UTF8);
  }
  if (fact.byteLength !== bytes.length || fact.blobId.length < MIN_ID_LENGTH) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const expectedHash = contentHashForBytes(hash, bytes);
  if (fact.contentHash !== expectedHash || fact.blobId !== textBlobIdForHash(expectedHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_HASH_MISMATCH);
  }
  return validFact(fact);
}

function textBlobBytes(fact: TextBlobFact, context: RopeFactValidationContext): Uint8Array | null {
  if (fact.storage.kind === INLINE_UTF8_BYTES_STORAGE_KIND) {
    return fact.storage.bytes;
  }
  if (
    fact.storage.kind === CONTENT_ADDRESSED_BLOB_STORE_KIND
    && fact.storage.storeId === TEXT_BLOB_STORE_ID
    && fact.storage.contentRef.length >= MIN_ID_LENGTH
  ) {
    return context.blobStore.readBlobBytes(fact.storage);
  }
  return null;
}

function textBlobFactForBytes(
  bytes: Uint8Array,
  storage: TextBlobStorage,
  hash: TextBlobHashPort,
): TextBlobFact {
  const contentHash = contentHashForBytes(hash, bytes);
  return {
    kind: TEXT_BLOB_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    blobId: textBlobIdForHash(contentHash),
    encoding: TEXT_BLOB_ENCODING_UTF8,
    byteLength: bytes.length,
    contentHash,
    storage,
  };
}

function inlineStorageForBytes(bytes: Uint8Array): InlineTextBlobStorage {
  return {
    kind: INLINE_UTF8_BYTES_STORAGE_KIND,
    bytes: bytes.slice(),
  };
}

function storedStorageForRef(contentRef: string): StoredTextBlobStorage {
  return {
    kind: CONTENT_ADDRESSED_BLOB_STORE_KIND,
    storeId: TEXT_BLOB_STORE_ID,
    contentRef,
  };
}

function contentHashForBytes(hash: TextBlobHashPort, bytes: Uint8Array): string {
  return hash.sha256Hex(`${GRAPH_ROPE_HASH_MATERIAL_PREFIX}${bytesToHex(bytes)}`);
}

function textBlobIdForHash(contentHash: string): string { return `${TEXT_BLOB_ID_PREFIX}${contentHash}`; }

function bytesToHex(bytes: Uint8Array): string { return Array.from(bytes, byteToHex).join(''); }

function byteToHex(byte: number): string { return byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'); }

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    TEXT_DECODER.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function validFact<TFact>(fact: TFact): FactValidationResult<TFact> {
  return { ok: true, fact };
}

function invalidFact<TFact>(code: FactValidationErrorCode): FactValidationResult<TFact> {
  return { ok: false, code };
}
