import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type DirectoryAction,
  type DirectoryIssue,
  type FileEntry,
  type FileSystemPort,
  DIRECTORY_ACTION_OPEN,
  DIRECTORY_ACTION_REFRESH,
} from '../ports/file-system.js';

type Throwable =
  | Error
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | {
    readonly code?: string;
    readonly message?: string;
  };

type FilesystemError = Error & {
  readonly code?: string;
};

export { DIRECTORY_ACTION_OPEN, DIRECTORY_ACTION_REFRESH };

const DIRECTORY_ERROR_TITLE_OPEN = 'Cannot open directory';
const DIRECTORY_ERROR_TITLE_REFRESH = 'Cannot refresh directory';

const ERROR_CODE_NOT_FOUND = 'ENOENT';
const ERROR_CODE_NOT_DIRECTORY = 'ENOTDIR';
const ERROR_CODE_PERMISSION_DENIED = 'EACCES';

export function loadEntries(cwd: string): readonly FileEntry[] {
  const parent = dirname(cwd);
  const entries: FileEntry[] = [];

  if (parent !== cwd) {
    entries.push({
      kind: 'parent',
      name: '..',
      path: parent,
    });
  }

  const fsEntries = readdirSync(cwd, { withFileTypes: true })
    .map((entry): FileEntry => ({
      kind: entry.isDirectory() ? 'dir' : 'file',
      name: entry.name,
      path: join(cwd, entry.name),
    }))
    .sort(compareEntries);

  return [...entries, ...fsEntries];
}

export function describeDirectoryIssue(
  action: DirectoryAction,
  cwd: string,
  cause: Error | string,
): DirectoryIssue {
  const error = toFilesystemError(cause);
  return {
    title: action === DIRECTORY_ACTION_REFRESH ? DIRECTORY_ERROR_TITLE_REFRESH : DIRECTORY_ERROR_TITLE_OPEN,
    message: formatDirectoryErrorMessage(cwd, error),
  };
}

export const FileSystemPortAdapter: FileSystemPort = {
  loadEntries,
  describeDirectoryIssue,
};

function compareEntries(a: FileEntry, b: FileEntry): number {
  if (a.kind === 'dir' && b.kind === 'file') {
    return -1;
  }
  if (a.kind === 'file' && b.kind === 'dir') {
    return 1;
  }
  return a.name.localeCompare(b.name);
}

function toFilesystemError(cause: Throwable): FilesystemError {
  if (cause instanceof Error) {
    return cause as FilesystemError;
  }

  const message = typeof cause === 'object'
    && cause != null
    && typeof cause.message === 'string'
    ? cause.message
    : String(cause);
  const error = new Error(message) as FilesystemError;

  if (
    typeof cause === 'object'
    && cause != null
    && typeof cause.code === 'string'
  ) {
    Object.defineProperty(error, 'code', {
      value: cause.code,
      enumerable: true,
      writable: false,
      configurable: true,
    });
  }

  return error;
}

function formatDirectoryErrorMessage(cwd: string, error: FilesystemError): string {
  if (error.code === ERROR_CODE_PERMISSION_DENIED) {
    return `permission denied: ${cwd}`;
  }
  if (error.code === ERROR_CODE_NOT_FOUND) {
    return `not found: ${cwd}`;
  }
  if (error.code === ERROR_CODE_NOT_DIRECTORY) {
    return `not a directory: ${cwd}`;
  }
  return error.message.length > 0 ? error.message : `could not access: ${cwd}`;
}
