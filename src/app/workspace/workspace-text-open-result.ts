import type { WorkspaceTextOpenBasis } from './workspace-text-open-basis.js';
import type { WorkspaceTextObservedReading } from './workspace-text-observed-reading.js';
import { readingCache } from './workspace-text-observed-reading.js';
import { WorkspaceTextResultKinds, type WorkspaceTextOpenResult } from './workspace-text-results.js';

export interface WorkspaceTextOpenResultRequest {
  readonly filePath: string;
}

export function openedWorkspaceTextResult(
  request: WorkspaceTextOpenResultRequest,
  basis: WorkspaceTextOpenBasis,
  bufferId: string,
  reading: WorkspaceTextObservedReading,
): WorkspaceTextOpenResult {
  const cache = readingCache(bufferId, reading);
  return {
    kind: WorkspaceTextResultKinds.Opened,
    filePath: request.filePath,
    bufferId,
    readOnly: basis.readOnly,
    materialization: basis.materialization,
    hostBasis: basis.hostBasis,
    hostFingerprint: basis.hostFingerprint,
    initialLines: cache.lines,
    cache,
  };
}
