import { initDefaultContext } from '@flyingrobots/bijou-node';
import { type App, perfOverlaySurface, run } from '@flyingrobots/bijou-tui';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from './ui/terminal-mouse.js';
import { createWorkspaceRuntime } from './app/workspace/runtime.js';
import type { WorkspaceModel } from './app/workspace/model.js';
import type { WorkspaceMsg } from './app/workspace/msg.js';

initDefaultContext();

const app = createWorkspaceRuntime();

if (process.env.JEDIT_PERF === '1') {
  const RealApp = app;
  const PerfApp: App<WorkspaceModel, WorkspaceMsg> = {
    init: () => {
      const [model, cmds] = RealApp.init();
      return [model, cmds];
    },
    update: (msg, model) => {
      const start = Date.now();
      const [nextModel, cmds] = RealApp.update(msg, model);
      const end = Date.now();
      return [{
        ...nextModel,
        lastFrameMs: start,
        frameTimeMs: end - start,
        frameTimeHistory: [end - start, ...nextModel.frameTimeHistory.slice(0, 99)],
      }, cmds];
    },
    view: (model) => {
      const screen = RealApp.view(model);
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
    routeRuntimeIssue: RealApp.routeRuntimeIssue,
  };
  run(PerfApp, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS });
} else {
  run(app, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS });
}
