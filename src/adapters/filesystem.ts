import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

class FilesystemError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'FilesystemError';
    this.code = code;
    Object.setPrototypeOf(this, FilesystemError.prototype);
  }
}

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
  dirname,
  join,
  resolve,
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
  return new FilesystemError(formatUnknownFilesystemError(cause), extractFilesystemCode(cause));
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

function extractFilesystemCode(cause: Throwable): string | undefined {
  return typeof cause === 'object'
    && cause != null
    && 'code' in cause
    && typeof cause.code === 'string'
    ? cause.code
    : undefined;
}

function formatUnknownFilesystemError(cause: Throwable): string {
  return typeof cause === 'object'
    && cause != null
    && typeof cause.message === 'string'
    ? cause.message
    : String(cause);
}
