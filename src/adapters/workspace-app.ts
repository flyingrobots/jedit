import {
  animate,
  type App,
  type Cmd,
} from '@flyingrobots/bijou-tui';
import { createNotificationTickCmd } from '../ui/feedback.js';
import { FileSystemPortAdapter } from './filesystem.js';
import { createWorkspaceRuntime } from '../app/workspace/runtime.js';
import type { WorkspaceInitialModelSnapshot } from '../app/workspace/init.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from '../app/workspace/msg.js';
import type { CreateDrawerAnimationCmd } from '../app/workspace/drawer.js';
import type { DrawerKind } from '../ui/drawer-layout.js';
import { createRaytracerProfilerPort } from './raytracer-profiler.js';
import { editorFilePort } from './editor-file.js';
import { createGraftSessionPort } from './graft-mcp-session.js';
import { createGraftSourceHighlighter } from './graft-source-highlighter.js';
import { createTitleSceneLoaderPort } from './title-scene-loader.js';
import { createInitialModelSnapshot } from './workspace-initial-model-snapshot.js';
import { createPerfApp } from './workspace-perf-app.js';

const TIME_TICK_DURATION_MS = Number.MAX_SAFE_INTEGER;
const DRAWER_DURATION_MS = 160;

export interface WorkspaceAppOptions {
  initialColumns: number;
  initialRows: number;
  initialWorkingDirectory: string;
  perfEnabled: boolean;
  nowMs?: () => number;
  random?: () => number;
  seed?: WorkspaceInitialModelSnapshot;
}

export function createWorkspaceApp(options: WorkspaceAppOptions): App<WorkspaceModel, WorkspaceMsg> {
  const nowMs = options.nowMs ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const editorFile = editorFilePort;
  const graftSession = createGraftSessionPort();
  const sourceHighlighter = createGraftSourceHighlighter();
  const titleSceneLoader = createTitleSceneLoaderPort();
  const runtime = createWorkspaceRuntime({
    initialColumns: options.initialColumns,
    initialRows: options.initialRows,
    initialWorkingDirectory: options.initialWorkingDirectory,
    fileSystem: FileSystemPortAdapter,
    editorFile,
    graftSession,
    sourceHighlighter,
    titleSceneLoader,
    profiler: createRaytracerProfilerPort(nowMs),
    initialModel: options.seed ?? createInitialModelSnapshot(nowMs(), options.initialWorkingDirectory, random),
    nowMs,
    createTimeTickCmd: () => createTimeTickCmd(),
    createNotificationTickCmd: () => createNotificationTickCmd((atMs) => ({
      type: WorkspaceMessageTypes.NotificationTick,
      atMs,
    })),
    createDrawerAnimationCmd: createDrawerAnimationCmd,
  });

  const app: App<WorkspaceModel, WorkspaceMsg> = {
    init: runtime.init,
    update: runtime.update,
    view: runtime.view,
    routeRuntimeIssue: runtime.routeRuntimeIssue,
  };

  return createPerfApp(app, {
    initialPerfVisible: options.perfEnabled,
  });
}

function createTimeTickCmd(): Cmd<WorkspaceMsg> {
  return animate<WorkspaceMsg>({
    type: 'tween',
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
    duration: TIME_TICK_DURATION_MS,
    onFrame: (value) => ({ type: WorkspaceMessageTypes.TimeTick, time: value / 1000 }),
  });
}

const createDrawerAnimationCmd: CreateDrawerAnimationCmd = (kind: DrawerKind, from: number, to: number) => [
  animate<WorkspaceMsg>({
    type: 'tween',
    from,
    to,
    duration: DRAWER_DURATION_MS,
    onFrame: (value) => ({ type: WorkspaceMessageTypes.DrawerProgress, kind, value }),
  }),
];
