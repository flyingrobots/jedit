import { animate, perfOverlaySurface, type App, type Cmd } from '@flyingrobots/bijou-tui';
import { BijouI18nAdapter } from './bijou-i18n-adapter.js';
import { createNotificationTickCmd } from '../ui/feedback.js';
import { JEDIT_THEME_ENV, resolveInitialJeditTheme } from '../ui/jedit-themes.js';
import { createWorkspaceRuntime, type WorkspaceRuntime } from '../app/workspace/runtime.js';
import type { WorkspaceInitialModelSnapshot } from '../app/workspace/init.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import type { WorkspaceMsg } from '../app/workspace/msg.js';
import type { CreateDrawerAnimationCmd } from '../app/workspace/drawer.js';
import type { DrawerKind } from '../ui/drawer-layout.js';

const TIME_TICK_DURATION_MS = Number.MAX_SAFE_INTEGER;
const DRAWER_DURATION_MS = 160;

export interface WorkspaceAppOptions {
  initialColumns: number;
  initialRows: number;
  initialWorkingDirectory: string;
  perfEnabled: boolean;
  nowMs?: () => number;
  seed?: WorkspaceInitialModelSnapshot;
}

export function createWorkspaceApp(options: WorkspaceAppOptions): App<WorkspaceModel, WorkspaceMsg> {
  const nowMs = options.nowMs ?? (() => Date.now());
  const runtime = createWorkspaceRuntime({
    initialColumns: options.initialColumns,
    initialRows: options.initialRows,
    initialWorkingDirectory: options.initialWorkingDirectory,
    initialModel: options.seed ?? createInitialModelSnapshot(nowMs()),
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

function createInitialModelSnapshot(nowMs: number): WorkspaceInitialModelSnapshot {
  return {
    titleSceneSeed: Math.random(),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter('en', 'ltr'),
    nowMs,
  };
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
      const screen = realApp.view(model);
      if (model.perfVisible) {
        perfOverlaySurface(screen, {
          label: 'jedit perf',
          width: model.columns,
          height: model.rows,
          lastFrameMs: model.lastFrameMs,
          frameTimeMs: model.frameTimeMs,
          frameTimeHistory: model.frameTimeHistory,
          theme: model.jeditTheme.perf,
        });
      }
      return screen;
    },
    routeRuntimeIssue: realApp.routeRuntimeIssue,
  };
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
