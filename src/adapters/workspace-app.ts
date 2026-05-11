import { perfOverlaySurface, type Surface } from '@flyingrobots/bijou';
import {
  animate,
  compositeSurface,
  type App,
  type Cmd,
  type ViewOutput,
} from '@flyingrobots/bijou-tui';
import { BijouI18nAdapter } from './bijou-i18n-adapter.js';
import { createNotificationTickCmd } from '../ui/feedback.js';
import { JEDIT_THEME_ENV, resolveInitialJeditTheme } from '../ui/jedit-themes.js';
import { loadEntries } from './filesystem.js';
import { createWorkspaceRuntime } from '../app/workspace/runtime.js';
import type { WorkspaceInitialModelSnapshot } from '../app/workspace/init.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import type { WorkspaceMsg } from '../app/workspace/msg.js';
import type { CreateDrawerAnimationCmd } from '../app/workspace/drawer.js';
import type { DrawerKind } from '../ui/drawer-layout.js';
import { createTitleBunnyMesh, type TitleMesh } from '../ui/title-mesh.js';
import { loadInitialTitleMesh, TITLE_MESH_LOAD_RESULT } from '../app/title-mesh-loader.js';
import { loadTitleBunnyMeshSource } from './title-bunny-mesh.js';
import { FileSystemPortAdapter } from './filesystem.js';
import { createRaytracerProfilerPort } from './raytracer-profiler.js';
import { editorFilePort } from './editor-file.js';
import { createGraftSessionPort } from './graft-mcp-session.js';
import { createGraftSourceHighlighter } from './graft-source-highlighter.js';
import { createTitleSceneLoaderPort } from './title-scene-loader.js';

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
    createNotificationTickCmd: () => createNotificationTickCmd((atMs) => ({ type: 'notification-tick', atMs })),
    createDrawerAnimationCmd: createDrawerAnimationCmd,
  });

  const app: App<WorkspaceModel, WorkspaceMsg> = {
    init: runtime.init,
    update: runtime.update,
    view: runtime.view,
    routeRuntimeIssue: runtime.routeRuntimeIssue,
  };

  return options.perfEnabled
    ? createPerfApp(app, nowMs)
    : app;
}

function createInitialModelSnapshot(
  nowMs: number,
  cwd: string,
  random: () => number,
): WorkspaceInitialModelSnapshot {
  return {
    entries: loadEntries(cwd),
    titleMesh: loadStartupTitleMesh(),
    titleSceneSeed: random(),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter('en', 'ltr'),
    nowMs,
  };
}

function loadStartupTitleMesh(): TitleMesh | undefined {
  const result = loadInitialTitleMesh({
    loadSource: loadTitleBunnyMeshSource,
    createMesh: createTitleBunnyMesh,
  });
  if (result.kind === TITLE_MESH_LOAD_RESULT.Loaded) {
    return result.mesh;
  }
  process.stderr.write(`jedit title mesh unavailable: ${result.error}\n`);
  return undefined;
}

function createPerfApp(
  realApp: App<WorkspaceModel, WorkspaceMsg>,
  nowMs: () => number,
): App<WorkspaceModel, WorkspaceMsg> {
  return {
    init: realApp.init,
    update: (msg, model) => {
      const start = nowMs();
      const [nextModel, cmds] = realApp.update(msg, model);
      const end = nowMs();
      return [{
        ...nextModel,
        lastFrameMs: start,
        frameTimeMs: end - start,
        frameTimeHistory: [end - start, ...nextModel.frameTimeHistory.slice(0, 99)],
      }, cmds];
    },
    view: (model) => {
      const viewOutput = realApp.view(model);
      const surface = toSurfaceView(viewOutput);
      if (model.perfVisible) {
        const perfSurface = perfOverlaySurface({
          width: model.columns,
          height: model.rows,
          fps: model.lastFrameMs === 0 ? 0 : Math.round(1000 / model.lastFrameMs),
          frameTimeMs: model.frameTimeMs,
          frameTimeHistory: model.frameTimeHistory,
        }, {
          title: 'jedit perf',
        });
        return compositeSurface(surface, [{ content: '', surface: perfSurface, row: 0, col: 0 }]);
      }
      return surface;
    },
    routeRuntimeIssue: realApp.routeRuntimeIssue,
  };
}

function toSurfaceView(viewOutput: ViewOutput): Surface {
  if (isSurface(viewOutput)) {
    return viewOutput;
  }
  throw new WorkspacePerfOverlayError('perf overlay requires surface view output');
}

function isSurface(value: ViewOutput): value is Surface {
  return value != null
    && typeof value === 'object'
    && 'width' in value
    && 'height' in value
    && 'set' in value
    && 'get' in value;
}

class WorkspacePerfOverlayError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkspacePerfOverlayError';
    if (Error.captureStackTrace != null) {
      Error.captureStackTrace(this, WorkspacePerfOverlayError);
    }
  }
}

function createTimeTickCmd(): Cmd<WorkspaceMsg> {
  return animate<WorkspaceMsg>({
    type: 'tween',
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
    duration: TIME_TICK_DURATION_MS,
    onFrame: (value) => ({ type: 'time-tick', time: value / 1000 }),
  });
}

const createDrawerAnimationCmd: CreateDrawerAnimationCmd = (kind: DrawerKind, from: number, to: number) => [
  animate<WorkspaceMsg>({
    type: 'tween',
    from,
    to,
    duration: DRAWER_DURATION_MS,
    onFrame: (value) => ({ type: 'drawer-progress', kind, value }),
  }),
];
