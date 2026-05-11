export const DIRECTORY_ACTION_OPEN = 1 as const;
export const DIRECTORY_ACTION_REFRESH = 2 as const;

export type DirectoryAction = typeof DIRECTORY_ACTION_OPEN | typeof DIRECTORY_ACTION_REFRESH;

export interface FileEntry {
  readonly kind: 'parent' | 'dir' | 'file';
  readonly name: string;
  readonly path: string;
}

export interface DirectoryIssue {
  readonly title: string;
  readonly message: string;
}

export interface FileSystemPort {
  readonly loadEntries: (cwd: string) => readonly FileEntry[];
  readonly describeDirectoryIssue: (action: DirectoryAction, cwd: string, cause: Error | string) => DirectoryIssue;
  readonly dirname: (cwd: string) => string;
  readonly join: (...parts: readonly string[]) => string;
}
