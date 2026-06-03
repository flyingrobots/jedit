import {
  closeSync,
  fdatasyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  JEDIT_WSC_WORKSPACE_STORE_DIGEST_MISMATCH,
  JEDIT_WSC_WORKSPACE_STORE_HOST_PATH_ERROR,
  JEDIT_WSC_WORKSPACE_STORE_INVALID_ENVELOPE_ID,
  JEDIT_WSC_WORKSPACE_STORE_LISTED,
  JEDIT_WSC_WORKSPACE_STORE_MISSING_ENVELOPE,
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  JEDIT_WSC_WORKSPACE_STORE_READ,
  JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
  type JeditWscWorkspaceEnvelope,
  type JeditWscWorkspaceListResult,
  type JeditWscWorkspaceObstructed,
  type JeditWscWorkspaceReadResult,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
  type JeditWscWorkspaceWriteResult,
} from '../ports/jedit-wsc-workspace-store.js';

const STORE_DIRECTORY_PARTS = ['.jedit', 'echo-wsc', 'envelopes'] as const;
const ENVELOPE_SUFFIX = '.wsc-envelope';
const WSC_ENVELOPE_ID_HEX_LENGTH = 64;
const WSC_ENVELOPE_ID_PATTERN = new RegExp(`^[0-9a-f]{${String(WSC_ENVELOPE_ID_HEX_LENGTH)}}$`, 'u');
const ERROR_CODE_NOT_FOUND = 'ENOENT';
const SHA256_ALGORITHM = 'sha256';
const HEX_DIGEST_ENCODING = 'hex';
const TEMP_ENVELOPE_SUFFIX = '.tmp';

export function createNodeJeditWscWorkspaceStore(
  workspaceRoot: string,
): JeditWscWorkspaceStorePort {
  const storeDirectory = path.join(workspaceRoot, ...STORE_DIRECTORY_PARTS);
  return {
    writeEnvelope(envelope) {
      return writeEnvelope(storeDirectory, envelope);
    },
    readEnvelope(envelopeId) {
      return readEnvelope(storeDirectory, envelopeId);
    },
    listEnvelopes() {
      return listEnvelopes(storeDirectory);
    },
  };
}

function writeEnvelope(
  storeDirectory: string,
  envelope: JeditWscWorkspaceEnvelope,
): JeditWscWorkspaceWriteResult {
  if (!isEnvelopeId(envelope.envelopeId)) {
    return invalidEnvelopeId(envelope.envelopeId);
  }
  const workspacePath = envelopePath(storeDirectory, envelope.envelopeId);
  if (!envelopeDigestMatches(envelope.envelopeId, envelope.bytes)) {
    return digestMismatch(envelope.envelopeId, workspacePath);
  }
  try {
    mkdirSync(storeDirectory, { recursive: true });
    writeEnvelopeBytesAtomically(workspacePath, envelope.bytes);
    return {
      status: JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
      envelopeId: envelope.envelopeId,
      byteLength: envelope.bytes.byteLength,
      workspacePath,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return hostPathObstructed(workspacePath, envelope.envelopeId, message);
  }
}

function readEnvelope(
  storeDirectory: string,
  envelopeId: string,
): JeditWscWorkspaceReadResult {
  if (!isEnvelopeId(envelopeId)) {
    return invalidEnvelopeId(envelopeId);
  }
  const workspacePath = envelopePath(storeDirectory, envelopeId);
  try {
    const bytes = readFileSync(workspacePath);
    if (!envelopeDigestMatches(envelopeId, bytes)) {
      return digestMismatch(envelopeId, workspacePath);
    }
    return {
      status: JEDIT_WSC_WORKSPACE_STORE_READ,
      envelope: {
        envelopeId,
        bytes,
      },
      workspacePath,
    };
  } catch (cause) {
    const code = cause instanceof Error && isCodedError(cause) ? cause.code : undefined;
    const message = cause instanceof Error ? cause.message : String(cause);
    return readFailure(workspacePath, envelopeId, code, message);
  }
}

function listEnvelopes(storeDirectory: string): JeditWscWorkspaceListResult {
  try {
    const envelopeIds = readdirSync(storeDirectory)
      .flatMap(envelopeIdFromFilename)
      .sort();
    const verified = verifyRetainedEnvelopes(storeDirectory, envelopeIds);
    if (verified != null) {
      return verified;
    }
    return listedEnvelopes(storeDirectory, envelopeIds);
  } catch (cause) {
    const code = cause instanceof Error && isCodedError(cause) ? cause.code : undefined;
    if (code === ERROR_CODE_NOT_FOUND) {
      return listedEnvelopes(storeDirectory, []);
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return hostPathObstructed(storeDirectory, undefined, message);
  }
}

function writeEnvelopeBytesAtomically(workspacePath: string, bytes: Uint8Array): void {
  const tempPath = temporaryEnvelopePath(workspacePath);
  let fd: number | undefined;
  let renamed = false;
  try {
    fd = openSync(tempPath, 'w');
    writeSync(fd, Buffer.from(bytes));
    fdatasyncSync(fd);
    const openFd = fd;
    fd = undefined;
    closeSync(openFd);
    renameSync(tempPath, workspacePath);
    renamed = true;
  } finally {
    if (fd != null) {
      closeSync(fd);
    }
    if (!renamed) {
      removeTemporaryEnvelope(tempPath);
    }
  }
}

function removeTemporaryEnvelope(tempPath: string): void {
  try {
    rmSync(tempPath, { force: true });
  } catch {
    // A failed cleanup should not mask the original filesystem error.
  }
}

function verifyRetainedEnvelopes(
  storeDirectory: string,
  envelopeIds: readonly string[],
): JeditWscWorkspaceObstructed | undefined {
  for (const envelopeId of envelopeIds) {
    const workspacePath = envelopePath(storeDirectory, envelopeId);
    if (!envelopeDigestMatches(envelopeId, readFileSync(workspacePath))) {
      return digestMismatch(envelopeId, workspacePath);
    }
  }
  return undefined;
}

function readFailure(
  workspacePath: string,
  envelopeId: string,
  code: string | undefined,
  message: string,
): JeditWscWorkspaceReadResult {
  return code === ERROR_CODE_NOT_FOUND
    ? missingEnvelope(envelopeId, workspacePath)
    : hostPathObstructed(workspacePath, envelopeId, message);
}

function listedEnvelopes(
  workspacePath: string,
  envelopeIds: readonly string[],
): JeditWscWorkspaceListResult {
  return {
    status: JEDIT_WSC_WORKSPACE_STORE_LISTED,
    envelopeIds,
    workspacePath,
  };
}

function missingEnvelope(envelopeId: string, workspacePath: string): JeditWscWorkspaceReadResult {
  return obstructed({
    code: JEDIT_WSC_WORKSPACE_STORE_MISSING_ENVELOPE,
    message: `missing WSC envelope: ${envelopeId}`,
    envelopeId,
    workspacePath,
  });
}

function invalidEnvelopeId(envelopeId: string): JeditWscWorkspaceObstructed {
  return obstructed({
    code: JEDIT_WSC_WORKSPACE_STORE_INVALID_ENVELOPE_ID,
    message: `invalid WSC envelope id: ${envelopeId}`,
    envelopeId,
  });
}

function digestMismatch(envelopeId: string, workspacePath: string): JeditWscWorkspaceObstructed {
  return obstructed({
    code: JEDIT_WSC_WORKSPACE_STORE_DIGEST_MISMATCH,
    message: `WSC envelope digest mismatch: ${envelopeId}`,
    envelopeId,
    workspacePath,
  });
}

function hostPathObstructed(
  workspacePath: string,
  envelopeId: string | undefined,
  message: string,
): JeditWscWorkspaceObstructed {
  return obstructed({
    code: JEDIT_WSC_WORKSPACE_STORE_HOST_PATH_ERROR,
    message,
    envelopeId,
    workspacePath,
  });
}

function obstructed(
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscWorkspaceObstructed {
  return {
    status: JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
    obstruction,
  };
}

function envelopePath(storeDirectory: string, envelopeId: string): string {
  return path.join(storeDirectory, `${envelopeId}${ENVELOPE_SUFFIX}`);
}

function temporaryEnvelopePath(workspacePath: string): string {
  return `${workspacePath}${TEMP_ENVELOPE_SUFFIX}`;
}

function envelopeIdFromFilename(filename: string): readonly string[] {
  if (!filename.endsWith(ENVELOPE_SUFFIX)) {
    return [];
  }
  const envelopeId = filename.slice(0, -ENVELOPE_SUFFIX.length);
  return isEnvelopeId(envelopeId) ? [envelopeId] : [];
}

function isEnvelopeId(envelopeId: string): boolean {
  return WSC_ENVELOPE_ID_PATTERN.test(envelopeId);
}

function envelopeDigestMatches(envelopeId: string, bytes: Uint8Array): boolean {
  return digestEnvelopeBytes(bytes) === envelopeId;
}

function digestEnvelopeBytes(bytes: Uint8Array): string {
  return createHash(SHA256_ALGORITHM).update(bytes).digest(HEX_DIGEST_ENCODING);
}

function isCodedError(cause: Error): cause is Error & { readonly code: string } {
  return 'code' in cause && typeof cause.code === 'string';
}
