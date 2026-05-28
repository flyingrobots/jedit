import type { App } from '@flyingrobots/bijou-tui';
import { FileSystemPortAdapter } from './filesystem.js';
import { createWorkspaceRuntime } from '../app/workspace/runtime.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import type { WorkspaceMsg } from '../app/workspace/msg.js';
import { createRaytracerProfilerPort } from './raytracer-profiler.js';
import { editorFilePort } from './editor-file.js';
import { createGraftSessionPort } from './graft-mcp-session.js';
import { createGraftSourceHighlighter } from './graft-source-highlighter.js';
import { createTitleSceneLoaderPort } from './title-scene-loader.js';
import { createInitialModelSnapshot } from './workspace-initial-model-snapshot.js';
import { createPerfApp } from './workspace-perf-app.js';
import {
  createWorkspaceProductionTextSession,
  resolveWorkspaceTextRuntimeProfile,
  type WorkspaceTextRuntimeProfileOptions,
} from './workspace-production-text-session.js';
import {
  createWorkspaceDrawerAnimationCmd,
  createWorkspaceNotificationTickCmd,
  createWorkspaceTimeTickCmd,
} from './workspace-animation-commands.js';

export interface WorkspaceAppOptions {
  initialColumns: number;
  initialRows: number;
  initialWorkingDirectory: string;
  textRuntimeProfile?: WorkspaceTextRuntimeProfileOptions['textRuntimeProfile'];
  perfEnabled: boolean;
  nowMs?: () => number;
  random?: () => number;
  seed?: ReturnType<typeof createInitialModelSnapshot>;
}

export function createWorkspaceApp(options: WorkspaceAppOptions): App<WorkspaceModel, WorkspaceMsg> {
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
  const textRuntimeProfile = resolveWorkspaceTextRuntimeProfile({
    textRuntimeProfile: options.textRuntimeProfile,
    seedTextRuntimeProfile: options.seed?.textRuntimeProfile,
  });
  const graftSession = createGraftSessionPort();
  const sourceHighlighter = createGraftSourceHighlighter();
  const titleSceneLoader = createTitleSceneLoaderPort();
  return {
    initialColumns: options.initialColumns,
    initialRows: options.initialRows,
    initialWorkingDirectory: options.initialWorkingDirectory,
    fileSystem: FileSystemPortAdapter,
    editorFile,
    productionTextSession: createWorkspaceProductionTextSession(textRuntimeProfile),
    graftSession,
    sourceHighlighter,
    titleSceneLoader,
    profiler: createRaytracerProfilerPort(nowMs),
    initialModel: {
      ...(options.seed ?? createInitialModelSnapshot(nowMs(), options.initialWorkingDirectory, random)),
      ...(options.textRuntimeProfile == null ? {} : {
        textRuntimeProfile,
      }),
    },
    nowMs,
    createTimeTickCmd: createWorkspaceTimeTickCmd,
    createNotificationTickCmd: createWorkspaceNotificationTickCmd,
    createDrawerAnimationCmd: createWorkspaceDrawerAnimationCmd,
  };
}

function workspaceRuntimeApp(runtime: ReturnType<typeof createWorkspaceRuntime>): App<WorkspaceModel, WorkspaceMsg> {
  return {
    init: runtime.init,
    update: runtime.update,
    view: runtime.view,
    routeRuntimeIssue: runtime.routeRuntimeIssue,
  };
}
