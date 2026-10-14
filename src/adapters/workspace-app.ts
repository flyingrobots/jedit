import { filePreviewSource } from './file-preview.js';
import { FileSystemPortAdapter } from './filesystem.js';
import { createWorkspaceRuntime } from '../app/workspace/runtime.js';
import { createRaytracerProfilerPort } from './raytracer-profiler.js';
import { editorFilePort } from './editor-file.js';
import { createGraftSessionPort } from './graft-api-session.js';
import {
  createGraftDiagnosticsPort,
  createGraftSourceHighlighter,
} from './graft-source-highlighter.js';
import { createInitialModelSnapshot } from './workspace-initial-model-snapshot.js';
import { createPerfApp } from './workspace-perf-app.js';
import type { WorkspaceProductionTextDependencies } from './workspace-production-text-dependencies.js';
import {
  createStartupFileDrawerAnimationCmd,
  createWorkspaceDrawerAnimationCmd,
  createWorkspaceNotificationTickCmd,
  createWorkspaceTimeTickCmd,
} from './workspace-animation-commands.js';

export interface WorkspaceAppOptions {
  initialColumns: number;
  initialRows: number;
  initialWorkingDirectory: string;
  perfEnabled: boolean;
  profileEnabled?: boolean;
  nowMs?: () => number;
  seed?: ReturnType<typeof createInitialModelSnapshot>;
}

export function createWorkspaceApp(
  options: WorkspaceAppOptions,
  productionText: WorkspaceProductionTextDependencies,
) {
  const nowMs = options.nowMs ?? (() => Date.now());
  const runtime = createWorkspaceRuntime(workspaceRuntimeDependencies(
    options,
    nowMs,
    productionText,
  ));
  return createPerfApp(workspaceRuntimeApp(runtime), {
    initialPerfVisible: options.perfEnabled,
  });
}

function workspaceRuntimeDependencies(
  options: WorkspaceAppOptions,
  nowMs: () => number,
  productionText: WorkspaceProductionTextDependencies,
) {
  const editorFile = editorFilePort;
  const graftDiagnostics = createGraftDiagnosticsPort();
  const graftSession = createGraftSessionPort();
  const sourceHighlighter = createGraftSourceHighlighter();
  return {
    filePreviewSource,
    initialColumns: options.initialColumns,
    initialRows: options.initialRows,
    initialWorkingDirectory: options.initialWorkingDirectory,
    fileSystem: FileSystemPortAdapter,
    editorFile,
    graftDiagnostics,
    productionTextSession: productionText.productionTextSession,
    graftSession,
    sourceHighlighter,
    profiler: createRaytracerProfilerPort(nowMs),
    profileOnStartup: options.profileEnabled ?? false,
    initialModel: options.seed ?? createInitialModelSnapshot(nowMs(), options.initialWorkingDirectory),
    nowMs,
    createTimeTickCmd: createWorkspaceTimeTickCmd,
    createNotificationTickCmd: createWorkspaceNotificationTickCmd,
    createDrawerAnimationCmd: createWorkspaceDrawerAnimationCmd,
    createStartupFileDrawerAnimationCmd,
  };
}

function workspaceRuntimeApp(runtime: ReturnType<typeof createWorkspaceRuntime>) {
  return {
    init: runtime.init,
    update: runtime.update,
    view: runtime.view,
    routeRuntimeIssue: runtime.routeRuntimeIssue,
  };
}
