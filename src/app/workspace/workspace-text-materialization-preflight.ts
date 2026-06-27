import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import {
  isDirectoryEditorFile,
  isLoadedEditorFile,
  isMissingEditorFile,
  isObstructedEditorFile,
  type EditorFileFingerprint,
  type EditorFileLoadResult,
  type EditorFilePort,
} from '../../ports/editor-file.js';
import {
  editorFileFingerprintFromText,
  editorFileFingerprintsEqual,
} from '../../ports/editor-file-fingerprint.js';
import { joinLines } from '../editor-lines.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import {
  WorkspaceTextHostBasisKinds,
  type WorkspaceTextHostBasisKind,
} from './workspace-text-authority.js';

const EXPORT_COLLISION_PREFIX = 'Text export blocked';

export interface WorkspaceTextMaterializationPreflightRequest {
  readonly filePath: string;
  readonly hostBasis: WorkspaceTextHostBasisKind;
  readonly hostFingerprint?: EditorFileFingerprint;
  readonly editorFile: Pick<EditorFilePort, 'loadEditorFile'>;
  readonly atMs: number;
}

export function materializationPreflightIssue(
  request: WorkspaceTextMaterializationPreflightRequest,
): RuntimeIssue | undefined {
  const observed = request.editorFile.loadEditorFile(request.filePath);
  return request.hostBasis === WorkspaceTextHostBasisKinds.Missing
    ? missingHostPreflightIssue(request, observed)
    : fileHostPreflightIssue(request, observed);
}

function missingHostPreflightIssue(
  request: WorkspaceTextMaterializationPreflightRequest,
  observed: EditorFileLoadResult,
): RuntimeIssue | undefined {
  return isMissingEditorFile(observed)
    ? undefined
    : observationIssue(request, observed, 'appeared on disk after open');
}

function fileHostPreflightIssue(
  request: WorkspaceTextMaterializationPreflightRequest,
  observed: EditorFileLoadResult,
): RuntimeIssue | undefined {
  if (!isLoadedEditorFile(observed)) {
    return missingOrPathKindIssue(request, observed);
  }
  const current = observed.fingerprint ?? editorFileFingerprintFromText(joinLines(observed.lines));
  return request.hostFingerprint == null
    || editorFileFingerprintsEqual(request.hostFingerprint, current)
    ? undefined
    : runtimeIssue(`${EXPORT_COLLISION_PREFIX}: ${request.filePath} changed on disk after open`, request.atMs);
}

function missingOrPathKindIssue(
  request: WorkspaceTextMaterializationPreflightRequest,
  observed: EditorFileLoadResult,
): RuntimeIssue {
  return isMissingEditorFile(observed)
    ? runtimeIssue(`${EXPORT_COLLISION_PREFIX}: ${request.filePath} was deleted after open`, request.atMs)
    : observationIssue(request, observed, 'changed host kind after open');
}

function observationIssue(
  request: WorkspaceTextMaterializationPreflightRequest,
  observed: EditorFileLoadResult,
  fileMessage: string,
): RuntimeIssue {
  if (isLoadedEditorFile(observed)) {
    return runtimeIssue(`${EXPORT_COLLISION_PREFIX}: ${request.filePath} ${fileMessage}`, request.atMs);
  }
  if (isDirectoryEditorFile(observed)) {
    return runtimeIssue(`${EXPORT_COLLISION_PREFIX}: ${request.filePath} is a directory`, request.atMs);
  }
  if (isObstructedEditorFile(observed)) {
    return runtimeIssue(`${EXPORT_COLLISION_PREFIX}: ${request.filePath} could not be read: ${observed.message}`, request.atMs);
  }
  return runtimeIssue(`${EXPORT_COLLISION_PREFIX}: ${request.filePath} was deleted after open`, request.atMs);
}

function runtimeIssue(message: string, atMs: number): RuntimeIssue {
  return {
    message,
    level: RuntimeIssueLevels.Error,
    source: RuntimeIssueSources.Command,
    atMs,
  };
}
