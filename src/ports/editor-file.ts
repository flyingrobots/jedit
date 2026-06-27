const LOAD_KIND_FILE = 'file';
const LOAD_KIND_MISSING = 'missing';

export const EditorFileLoadKinds = Object.freeze({
  File: LOAD_KIND_FILE,
  Missing: LOAD_KIND_MISSING,
} as const);

export type EditorFileLoadKind =
  typeof EditorFileLoadKinds[keyof typeof EditorFileLoadKinds];

export interface LoadedEditorFile {
  readonly kind?: typeof LOAD_KIND_FILE;
  readonly lines: readonly string[];
  readonly readOnly: boolean;
}

export interface MissingEditorFile {
  readonly kind: typeof LOAD_KIND_MISSING;
  readonly filePath: string;
}

export type EditorFileLoadResult =
  | LoadedEditorFile
  | MissingEditorFile;

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

export function isMissingEditorFile(
  result: EditorFileLoadResult,
): result is MissingEditorFile {
  return result.kind === LOAD_KIND_MISSING;
}
