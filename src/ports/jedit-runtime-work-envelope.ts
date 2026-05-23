import type { HashPort } from './hash.js';

export const JEDIT_RUNTIME_WORK_ENVELOPE_KIND = 'jedit.runtime-work-envelope';
export const JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION = 'MUTATION';
export const JEDIT_RUNTIME_WORK_OPERATION_KIND_QUERY = 'QUERY';

const SUBMISSION_ID_PREFIX = 'jedit-submission:';

export type JeditRuntimeWorkOperationKind =
  | typeof JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION
  | typeof JEDIT_RUNTIME_WORK_OPERATION_KIND_QUERY;

export interface JeditRuntimeWorkEnvelopeInput {
  readonly packageId: string;
  readonly operationName: string;
  readonly operationKind: JeditRuntimeWorkOperationKind;
  readonly canonicalRequestBytes: Uint8Array;
}

export interface JeditRuntimeWorkEnvelope {
  readonly kind: typeof JEDIT_RUNTIME_WORK_ENVELOPE_KIND;
  readonly packageId: string;
  readonly operationName: string;
  readonly operationKind: JeditRuntimeWorkOperationKind;
  readonly canonicalRequestBytesHex: string;
  readonly canonicalRequestDigest: string;
  readonly requestByteLength: number;
  readonly submissionId: string;
}

export interface JeditRuntimeWorkSink {
  recordRuntimeWorkEnvelope(envelope: JeditRuntimeWorkEnvelope): void;
}

export function createJeditRuntimeWorkEnvelope(
  input: JeditRuntimeWorkEnvelopeInput,
  hash: HashPort,
): JeditRuntimeWorkEnvelope {
  const canonicalRequestBytesHex = bytesToHex(input.canonicalRequestBytes);
  const canonicalRequestDigest = hash.sha256Hex(canonicalRequestBytesHex);
  const submissionId = toSubmissionId(input, canonicalRequestBytesHex, hash);

  return Object.freeze({
    kind: JEDIT_RUNTIME_WORK_ENVELOPE_KIND,
    packageId: input.packageId,
    operationName: input.operationName,
    operationKind: input.operationKind,
    canonicalRequestBytesHex,
    canonicalRequestDigest,
    requestByteLength: input.canonicalRequestBytes.length,
    submissionId,
  });
}

function toSubmissionId(
  input: JeditRuntimeWorkEnvelopeInput,
  canonicalRequestBytesHex: string,
  hash: HashPort,
): string {
  return `${SUBMISSION_ID_PREFIX}${hash.sha256Hex(JSON.stringify({
    kind: JEDIT_RUNTIME_WORK_ENVELOPE_KIND,
    packageId: input.packageId,
    operationName: input.operationName,
    operationKind: input.operationKind,
    canonicalRequestBytesHex,
  }))}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, toHexByte).join('');
}

function toHexByte(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}
