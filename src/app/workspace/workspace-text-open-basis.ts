import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import {
  isDirectoryEditorFile,
  isMissingEditorFile,
  isObstructedEditorFile,
  type EditorFileFingerprint,
  type EditorFilePort,
} from '../../ports/editor-file.js';
import { editorFileFingerprintFromText } from '../../ports/editor-file-fingerprint.js';
import { joinLines } from '../editor-lines.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import {
  WorkspaceTextHostBasisKinds,
  type WorkspaceTextHostBasisKind,
} from './workspace-text-authority.js';
import {
  WorkspaceWorldlineMaterializationKinds,
  type WorkspaceWorldlineMaterializationKind,
} from './worldline-types.js';

const OPEN_BASIS_READY = 'ready';
const OPEN_BASIS_OBSTRUCTED = 'obstructed';
const OPEN_FAILURE_PREFIX = 'Text open failed';
const EMPTY_INITIAL_TEXT = '';

export const WorkspaceTextOpenBasisResultKinds = Object.freeze({
  Ready: OPEN_BASIS_READY,
  Obstructed: OPEN_BASIS_OBSTRUCTED,
} as const);

export interface WorkspaceTextOpenBasisRequest {
  readonly filePath: string;
  readonly editorFile: Pick<EditorFilePort, 'loadEditorFile'>;
  readonly atMs: number;
}

export interface WorkspaceTextOpenBasis {
  readonly initialText: string;
  readonly readOnly: boolean;
  readonly materialization: WorkspaceWorldlineMaterializationKind;
  readonly hostBasis: WorkspaceTextHostBasisKind;
  readonly hostFingerprint?: EditorFileFingerprint;
}

export type WorkspaceTextOpenBasisResult =
  | {
      readonly kind: typeof OPEN_BASIS_READY;
      readonly basis: WorkspaceTextOpenBasis;
    }
  | {
      readonly kind: typeof OPEN_BASIS_OBSTRUCTED;
      readonly issue: RuntimeIssue;
    };

export function workspaceTextOpenBasis(
  request: WorkspaceTextOpenBasisRequest,
): WorkspaceTextOpenBasisResult {
  const loaded = request.editorFile.loadEditorFile(request.filePath);
  if (isMissingEditorFile(loaded)) {
    return readyOpenBasis({
      initialText: EMPTY_INITIAL_TEXT,
      readOnly: false,
      materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
      hostBasis: WorkspaceTextHostBasisKinds.Missing,
    });
  }
  if (isDirectoryEditorFile(loaded)) {
    return openBasisIssue(request, 'is a directory');
  }
  if (isObstructedEditorFile(loaded)) {
    return openBasisIssue(request, loaded.message);
  }
  const initialText = joinLines(loaded.lines);
  return readyOpenBasis({
    initialText,
    readOnly: loaded.readOnly,
    materialization: WorkspaceWorldlineMaterializationKinds.Materialized,
    hostBasis: WorkspaceTextHostBasisKinds.File,
    hostFingerprint: loaded.fingerprint ?? editorFileFingerprintFromText(initialText),
  });
}

function openBasisIssue(
  request: WorkspaceTextOpenBasisRequest,
  message: string,
): WorkspaceTextOpenBasisResult {
  return {
    kind: OPEN_BASIS_OBSTRUCTED,
    issue: runtimeIssue(`${OPEN_FAILURE_PREFIX}: ${request.filePath}: ${message}`, request.atMs),
  };
}

function readyOpenBasis(
  basis: WorkspaceTextOpenBasis,
): WorkspaceTextOpenBasisResult {
  return {
    kind: OPEN_BASIS_READY,
    basis,
  };
}

function runtimeIssue(message: string, atMs: number): RuntimeIssue {
  return {
    message,
    level: RuntimeIssueLevels.Error,
    source: RuntimeIssueSources.Command,
    atMs,
  };
}
