export const JEDIT_WSC_WORKSPACE_STORE_WRITTEN = 'JEDIT_WSC_WORKSPACE_STORE_WRITTEN';
export const JEDIT_WSC_WORKSPACE_STORE_READ = 'JEDIT_WSC_WORKSPACE_STORE_READ';
export const JEDIT_WSC_WORKSPACE_STORE_LISTED = 'JEDIT_WSC_WORKSPACE_STORE_LISTED';
export const JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED = 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED';
export const JEDIT_WSC_WORKSPACE_STORE_INVALID_ENVELOPE_ID = 'invalid_envelope_id';
export const JEDIT_WSC_WORKSPACE_STORE_HOST_PATH_ERROR = 'host_path_error';
export const JEDIT_WSC_WORKSPACE_STORE_MISSING_ENVELOPE = 'missing_envelope';
export const JEDIT_WSC_WORKSPACE_STORE_DIGEST_MISMATCH = 'digest_mismatch';

export const JEDIT_WSC_WORKSPACE_STORE_STATUS = Object.freeze({
  Written: JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
  Read: JEDIT_WSC_WORKSPACE_STORE_READ,
  Listed: JEDIT_WSC_WORKSPACE_STORE_LISTED,
  Obstructed: JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
} as const);

export interface JeditWscWorkspaceEnvelope {
  readonly envelopeId: string;
  readonly bytes: Uint8Array;
}

export interface JeditWscWorkspaceStoreObstruction {
  readonly code: string;
  readonly message: string;
  readonly envelopeId?: string;
  readonly workspacePath?: string;
}

export interface JeditWscWorkspaceWriteReceipt {
  readonly status: typeof JEDIT_WSC_WORKSPACE_STORE_WRITTEN;
  readonly envelopeId: string;
  readonly byteLength: number;
  readonly workspacePath: string;
}

export interface JeditWscWorkspaceReadReceipt {
  readonly status: typeof JEDIT_WSC_WORKSPACE_STORE_READ;
  readonly envelope: JeditWscWorkspaceEnvelope;
  readonly workspacePath: string;
}

export interface JeditWscWorkspaceListReceipt {
  readonly status: typeof JEDIT_WSC_WORKSPACE_STORE_LISTED;
  readonly envelopeIds: readonly string[];
  readonly workspacePath: string;
}

export interface JeditWscWorkspaceObstructed {
  readonly status: typeof JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED;
  readonly obstruction: JeditWscWorkspaceStoreObstruction;
}

export type JeditWscWorkspaceWriteResult =
  | JeditWscWorkspaceWriteReceipt
  | JeditWscWorkspaceObstructed;
export type JeditWscWorkspaceReadResult =
  | JeditWscWorkspaceReadReceipt
  | JeditWscWorkspaceObstructed;
export type JeditWscWorkspaceListResult =
  | JeditWscWorkspaceListReceipt
  | JeditWscWorkspaceObstructed;

export interface JeditWscWorkspaceStorePort {
  writeEnvelope(envelope: JeditWscWorkspaceEnvelope): JeditWscWorkspaceWriteResult;
  readEnvelope(envelopeId: string): JeditWscWorkspaceReadResult;
  listEnvelopes(): JeditWscWorkspaceListResult;
}
