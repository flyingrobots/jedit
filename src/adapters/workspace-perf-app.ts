import { perfOverlaySurface, type Surface } from '@flyingrobots/bijou';
import {
  compositeSurface,
  type App,
  type ViewOutput,
} from '@flyingrobots/bijou-tui';
import type { WorkspaceModel } from '../app/workspace/model.js';
import type { WorkspaceMsg } from '../app/workspace/msg.js';

export interface PerfAppOptions {
  readonly initialPerfVisible: boolean;
}

export function createPerfApp(
  realApp: App<WorkspaceModel, WorkspaceMsg>,
  options: PerfAppOptions,
): App<WorkspaceModel, WorkspaceMsg> {
  return {
    init: () => {
      const [model, cmds] = realApp.init();
      return [{
        ...model,
        perfVisible: options.initialPerfVisible || model.perfVisible,
      }, cmds];
    },
    update: realApp.update,
    view: (model) => {
      const viewOutput = realApp.view(model);
      const surface = toSurfaceView(viewOutput);
      if (model.perfVisible) {
        const memory = process.memoryUsage();
        const perfSurface = perfOverlaySurface({
          width: model.columns,
          height: model.rows,
          fps: model.frameTimeMs <= 0 ? 0 : Math.round(1000 / model.frameTimeMs),
          frameTimeMs: model.frameTimeMs,
          frameTimeHistory: model.frameTimeHistory,
          heapUsedMB: bytesToMegabytes(memory.heapUsed),
          rssMB: bytesToMegabytes(memory.rss),
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

function bytesToMegabytes(bytes: number): number {
  return bytes / 1024 / 1024;
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
