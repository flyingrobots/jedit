export const FilePreviewKinds = Object.freeze({ Loaded: 'loaded', Binary: 'binary', Unavailable: 'unavailable' } as const);
export const FILE_PREVIEW_MAX_BYTES = 65_536;
export const FILE_PREVIEW_MAX_LINES = 200;

export type FilePreviewResult =
  | { readonly kind: typeof FilePreviewKinds.Loaded; readonly lines: readonly string[]; readonly truncated: boolean }
  | { readonly kind: typeof FilePreviewKinds.Binary }
  | { readonly kind: typeof FilePreviewKinds.Unavailable };

export interface FilePreviewSource {
  readonly loadFilePreview: (path: string) => FilePreviewResult;
}
