import { animate, type App, type Cmd } from '@flyingrobots/bijou-tui';
import { createInitialModel } from './init.js';
import { manageGraftLifecycle } from './graft.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import {
  applyNotificationState,
  createNotificationTickCmd,
  pushRuntimeIssueToast,
  tickNotificationState,
} from '../../ui/feedback.js';
import { reduceSourceHighlightMsg, SOURCE_HIGHLIGHT_MESSAGE } from '../source-highlight-session.js';
import { reduceTitleCameraMotion, TITLE_CAMERA_MESSAGE, type TitleCameraMotionMsg } from '../title-camera-session.js';
import { ensureEditorVisible, editorViewport } from './editor-session.js';
import { updateFromKey } from './key-bindings.js';
import { updateFromMouse } from './mouse.js';
import { clamp01, clampIndex } from './viewport.js';
import { renderWorkspace } from './viewer.js';
import { reduceProfilerMsg, type ProfilerMsg } from '../raytracer-profiler.js';
import { createInitialProfilerState } from '../raytracer-profiler.js';

export const INITIAL_COLUMNS = process.stdout.columns ?? 100;
export const INITIAL_ROWS = process.stdout.rows ?? 32;

export const createWorkspaceRuntime = (): App<WorkspaceModel, WorkspaceMsg> => ({
  init: () => [
    {
      ...createInitialModel(process.cwd(), INITIAL_COLUMNS, INITIAL_ROWS),
      profiler: createInitialProfilerState(),
    },
    [
      manageGraftLifecycle(),
      animate<WorkspaceMsg>({
        type: 'tween',
        from: 0,
        to: Number.MAX_SAFE_INTEGER,
        duration: Number.MAX_SAFE_INTEGER,
        onFrame: (value) => ({ type: 'time-tick', time: value / 1000 }),
      }),
    ],
  ],
  update: (msg, model): [WorkspaceModel, Cmd<WorkspaceMsg>[]] => {
    if (msg.type === 'resize') {
      const viewport = editorViewport({
        ...model,
        columns: msg.columns,
        rows: msg.rows,
      });
      const resized: WorkspaceModel = {
        ...model,
        columns: msg.columns,
        rows: msg.rows,
        editor: model.editor == null
          ? undefined
          : ensureEditorVisible(model.editor, viewport.width, viewport.height),
      };
      return applyNotificationState(resized, resized.notifications, Date.now(), notificationTickCmd);
    }

    if (msg.type === 'drawer-progress') {
      const nextModel: WorkspaceModel = msg.kind === 'files'
        ? { ...model, fileDrawerProgress: clamp01(msg.value) }
        : { ...model, graftDrawerProgress: clamp01(msg.value) };
      return [nextModel, []];
    }

    if (msg.type === 'graft-info') {
      if (msg.requestId !== model.graftRequestId) {
        return [model, []];
      }

      return [{
        ...model,
        graftInfo: msg.info,
        graftLoading: false,
        graftSelectedIndex: clampIndex(model.graftSelectedIndex, msg.info.outlineItems.length),
      }, []];
    }

    if (msg.type === 'load-scene-result') {
      return [{ ...model, sceneOverride: msg.scene }, []];
    }

    if (msg.type === SOURCE_HIGHLIGHT_MESSAGE) {
      return [reduceSourceHighlightMsg(model, msg), []];
    }

    if (msg.type === TITLE_CAMERA_MESSAGE.Frame) {
      return [{ ...model, titleCamera: reduceTitleCameraMotion(model.titleCamera, msg) }, []];
    }

    if (msg.type === 'notification-tick') {
      return tickNotificationState(model, msg.atMs, notificationTickCmd);
    }

    if (msg.type === 'time-tick') {
      const now = Date.now();
      const frameTime = now - model.lastFrameMs;
      return [{
        ...model,
        time: msg.time,
        lastFrameMs: now,
        frameTimeMs: frameTime,
        frameTimeHistory: [...model.frameTimeHistory, frameTime].slice(-50),
      }, []];
    }

    if (msg.type === 'toggle-perf') {
      return [{ ...model, perfVisible: !model.perfVisible }, []];
    }

    if (msg.type === 'runtime-issue') {
      return pushRuntimeIssueToast(model, msg.issue, notificationTickCmd);
    }

    if (isProfilerMsg(msg)) {
      return [{ ...model, profiler: reduceProfilerMsg(model.profiler, msg) }, []];
    }

    if (msg.type === 'mouse') {
      return updateFromMouse(msg, model);
    }

    if (msg.type !== 'key') {
      return [model, []];
    }

    return updateFromKey(msg, model);
  },
  view: (model) => renderWorkspace(model),
  routeRuntimeIssue: (issue) => ({ type: 'runtime-issue', issue }),
});

function isProfilerMsg(msg: WorkspaceMsg): msg is ProfilerMsg {
  return msg.type === 'profiler-started' || msg.type === 'profiler-stopped';
}

function notificationTickCmd(): Cmd<WorkspaceMsg> {
  return createNotificationTickCmd((atMs) => ({ type: 'notification-tick', atMs }));
}
