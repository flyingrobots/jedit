import { animate, perfOverlaySurface, type App, type Cmd } from '@flyingrobots/bijou-tui';
import {
  createNotificationTickCmd,
} from '../ui/feedback.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import type { WorkspaceMsg } from '../app/workspace/msg.js';
import { createWorkspaceRuntime, type WorkspaceRuntime } from '../app/workspace/runtime.js';

export interface WorkspaceAppOptions {
  initialColumns: number;
  initialRows: number;
  initialWorkingDirectory: string;
  perfEnabled: boolean;
}

const TIME_TICK_DURATION_MS = Number.MAX_SAFE_INTEGER;

export interface WorkspaceAdapterApp {
  readonly app: App<WorkspaceModel, WorkspaceMsg>;
}

export function createWorkspaceApp(options: WorkspaceAppOptions): App<WorkspaceModel, WorkspaceMsg> {
  const runtime: WorkspaceRuntime = createWorkspaceRuntime({
    initialColumns: options.initialColumns,
    initialRows: options.initialRows,
    initialWorkingDirectory: options.initialWorkingDirectory,
    createTimeTickCmd: () => createTimeTickCmd(),
    createNotificationTickCmd: () => createNotificationTickCmd((atMs) => ({ type: 'notification-tick', atMs })),
  });

  const app: App<WorkspaceModel, WorkspaceMsg> = {
    init: runtime.init,
    update: runtime.update,
    view: runtime.view,
    routeRuntimeIssue: runtime.routeRuntimeIssue,
  };

  return options.perfEnabled
    ? createPerfApp(app)
    : app;
}

function createPerfApp(realApp: App<WorkspaceModel, WorkspaceMsg>): App<WorkspaceModel, WorkspaceMsg> {
  return {
    init: realApp.init,
    update: (msg, model) => {
      const start = Date.now();
      const [nextModel, cmds] = realApp.update(msg, model);
      const end = Date.now();
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
