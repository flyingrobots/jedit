import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
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
const ERROR_CODE_NOT_FOUND = 'ENOENT';

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
  const workspacePath = envelopePath(storeDirectory, envelope.envelopeId);
  if (!isEnvelopeId(envelope.envelopeId)) {
    return invalidEnvelopeId(envelope.envelopeId);
  }
  try {
    mkdirSync(storeDirectory, { recursive: true });
    writeFileSync(workspacePath, Buffer.from(envelope.bytes));
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
  const workspacePath = envelopePath(storeDirectory, envelopeId);
  if (!isEnvelopeId(envelopeId)) {
    return invalidEnvelopeId(envelopeId);
  }
  try {
    return {
      status: JEDIT_WSC_WORKSPACE_STORE_READ,
      envelope: {
        envelopeId,
        bytes: readFileSync(workspacePath),
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
    if (!existsSync(storeDirectory)) {
      return listedEnvelopes(storeDirectory, []);
    }
    const envelopeIds = readdirSync(storeDirectory)
      .flatMap(envelopeIdFromFilename)
      .sort();
    return listedEnvelopes(storeDirectory, envelopeIds);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return hostPathObstructed(storeDirectory, undefined, message);
  }
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

function envelopeIdFromFilename(filename: string): readonly string[] {
  if (!filename.endsWith(ENVELOPE_SUFFIX)) {
    return [];
  }
  const envelopeId = filename.slice(0, -ENVELOPE_SUFFIX.length);
  return isEnvelopeId(envelopeId) ? [envelopeId] : [];
}

function isEnvelopeId(envelopeId: string): boolean {
  return envelopeId.length === WSC_ENVELOPE_ID_HEX_LENGTH
    && Array.from(envelopeId).every(isLowerHexCharacter);
}

function isLowerHexCharacter(character: string): boolean {
  return (character >= '0' && character <= '9')
    || (character >= 'a' && character <= 'f');
}

function isCodedError(cause: Error): cause is Error & { readonly code: string } {
  return 'code' in cause && typeof cause.code === 'string';
}
