const LOAD_KIND_FILE = 'file';
const LOAD_KIND_MISSING = 'missing';
const LOAD_KIND_DIRECTORY = 'directory';
const LOAD_KIND_OBSTRUCTED = 'obstructed';
const FINGERPRINT_ALGORITHM_SHA256 = 'sha256';

export const EditorFileLoadKinds = Object.freeze({
  File: LOAD_KIND_FILE,
  Missing: LOAD_KIND_MISSING,
  Directory: LOAD_KIND_DIRECTORY,
  Obstructed: LOAD_KIND_OBSTRUCTED,
} as const);

export const EditorFileFingerprintAlgorithms = Object.freeze({
  Sha256: FINGERPRINT_ALGORITHM_SHA256,
} as const);

export type EditorFileLoadKind =
  typeof EditorFileLoadKinds[keyof typeof EditorFileLoadKinds];

export type EditorFileFingerprintAlgorithm =
  typeof EditorFileFingerprintAlgorithms[keyof typeof EditorFileFingerprintAlgorithms];

export interface EditorFileFingerprint {
  readonly algorithm: EditorFileFingerprintAlgorithm;
  readonly digest: string;
  readonly byteLength: number;
}

export interface LoadedEditorFile {
  readonly kind?: typeof LOAD_KIND_FILE;
  readonly lines: readonly string[];
  readonly readOnly: boolean;
  readonly fingerprint?: EditorFileFingerprint;
}

export interface MissingEditorFile {
  readonly kind: typeof LOAD_KIND_MISSING;
  readonly filePath: string;
}

export interface DirectoryEditorFile {
  readonly kind: typeof LOAD_KIND_DIRECTORY;
  readonly filePath: string;
}

export interface ObstructedEditorFile {
  readonly kind: typeof LOAD_KIND_OBSTRUCTED;
  readonly filePath: string;
  readonly message: string;
  readonly code?: string;
}

export type EditorFileLoadResult =
  | LoadedEditorFile
  | MissingEditorFile
  | DirectoryEditorFile
  | ObstructedEditorFile;

export interface EditorFilePort {
  loadEditorFile(filePath: string): EditorFileLoadResult;
  saveEditorFile(filePath: string, lines: readonly string[]): void;
}

export function missingEditorFile(filePath: string): MissingEditorFile {
  return {
    kind: LOAD_KIND_MISSING,
    filePath,
  };
}

export function directoryEditorFile(filePath: string): DirectoryEditorFile {
  return {
    kind: LOAD_KIND_DIRECTORY,
    filePath,
  };
}

export function obstructedEditorFile(
  filePath: string,
  message: string,
  code?: string,
): ObstructedEditorFile {
  return {
    kind: LOAD_KIND_OBSTRUCTED,
    filePath,
    message,
    code,
  };
}

export function isLoadedEditorFile(
  result: EditorFileLoadResult,
): result is LoadedEditorFile {
  return result.kind == null || result.kind === LOAD_KIND_FILE;
}

export function isMissingEditorFile(
  result: EditorFileLoadResult,
): result is MissingEditorFile {
  return result.kind === LOAD_KIND_MISSING;
}

export function isDirectoryEditorFile(
  result: EditorFileLoadResult,
): result is DirectoryEditorFile {
  return result.kind === LOAD_KIND_DIRECTORY;
}

export function isObstructedEditorFile(
  result: EditorFileLoadResult,
): result is ObstructedEditorFile {
  return result.kind === LOAD_KIND_OBSTRUCTED;
}
