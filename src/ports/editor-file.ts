export interface LoadedEditorFile {
  readonly lines: readonly string[];
  readonly readOnly: boolean;
}

export interface EditorFilePort {
  loadEditorFile(filePath: string): LoadedEditorFile;
  saveEditorFile(filePath: string, lines: readonly string[]): void;
}
