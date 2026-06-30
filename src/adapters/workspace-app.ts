import { FileSystemPortAdapter } from './filesystem.js';
import { createWorkspaceRuntime } from '../app/workspace/runtime.js';
import { createRaytracerProfilerPort } from './raytracer-profiler.js';
import { editorFilePort } from './editor-file.js';
import { createGraftSessionPort } from './graft-api-session.js';
import {
  createGraftDiagnosticsPort,
  createGraftSourceHighlighter,
} from './graft-source-highlighter.js';
import { createTitleSceneLoaderPort } from './title-scene-loader.js';
import { createInitialModelSnapshot } from './workspace-initial-model-snapshot.js';
import { createNodeJeditWscWorkspaceStore } from './jedit-wsc-workspace-store.js';
import { createPerfApp } from './workspace-perf-app.js';
import { createWorkspaceProductionTextDependencies } from './workspace-production-text-dependencies.js';
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
  random?: () => number;
  seed?: ReturnType<typeof createInitialModelSnapshot>;
}

export function createWorkspaceApp(options: WorkspaceAppOptions) {
  const nowMs = options.nowMs ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const runtime = createWorkspaceRuntime(workspaceRuntimeDependencies(options, nowMs, random));
  return createPerfApp(workspaceRuntimeApp(runtime), {
    initialPerfVisible: options.perfEnabled,
  });
}

function workspaceRuntimeDependencies(
  options: WorkspaceAppOptions,
  nowMs: () => number,
  random: () => number,
) {
  const editorFile = editorFilePort;
  const graftDiagnostics = createGraftDiagnosticsPort();
  const graftSession = createGraftSessionPort();
  const sourceHighlighter = createGraftSourceHighlighter();
  const titleSceneLoader = createTitleSceneLoaderPort();
  const productionText = createWorkspaceProductionTextDependencies();
  return {
    initialColumns: options.initialColumns,
    initialRows: options.initialRows,
    initialWorkingDirectory: options.initialWorkingDirectory,
    fileSystem: FileSystemPortAdapter,
    editorFile,
    graftDiagnostics,
    productionTextSession: productionText.productionTextSession,
    textOperationSequencer: productionText.textOperationSequencer,
    wscWorkspaceStore: createNodeJeditWscWorkspaceStore(options.initialWorkingDirectory),
    graftSession,
    sourceHighlighter,
    titleSceneLoader,
    profiler: createRaytracerProfilerPort(nowMs),
    profileOnStartup: options.profileEnabled ?? false,
    initialModel: options.seed ?? createInitialModelSnapshot(nowMs(), options.initialWorkingDirectory, random),
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
