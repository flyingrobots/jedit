import { animate, type App, type Cmd } from '@flyingrobots/bijou-tui';
import { createInitialModel } from './init.js';
import { manageGraftLifecycle } from './graft.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import {
  pushRuntimeIssueToast,
  tickNotificationState,
  applyNotificationState,
  notificationTickCmd,
} from '../../ui/feedback.js';
import { editorViewport, ensureEditorVisible } from '../../main.js'; // Assuming these are still needed for resize
import { clamp01, clampIndex } from '../../main.js'; // Might be needed by applyNotificationState or for general use
// Removed handlers for 'drawer-progress', 'graft-info', 'load-scene-result', 'toggle-profiler', 'SourceHighlightMsg', 'TitleCameraMotionMsg', 'toggle-perf', 'mouse', and 'key'
// Removed imports for those handlers and their dependencies where possible.

export const createWorkspaceRuntime = (): App<WorkspaceModel, WorkspaceMsg> => ({
  init: () => [
    createInitialModel(process.cwd(), process.stdout.columns ?? 100, process.stdout.rows ?? 32),
    [
      manageGraftLifecycle(),
      animate<WorkspaceMsg>({
        type: 'tween',
        from: 0,
        to: Number.MAX_SAFE_INTEGER,
        duration: Number.MAX_SAFE_INTEGER,
        onFrame: (v) => ({ type: 'time-tick', time: v / 1000 }),
      }),
    ],
  ],
  update: (msg, model): [WorkspaceModel, Cmd<WorkspaceMsg>[]] => {
    console.log('Received message:', msg.type); // Log message type for debugging

    if (msg.type === 'resize') {
      const viewport = editorViewport({ ...model, columns: msg.columns, rows: msg.rows });
      const resized = { ...model, columns: msg.columns, rows: msg.rows, editor: model.editor == null ? undefined : ensureEditorVisible(model.editor, viewport.width, viewport.height) };
      return applyNotificationState(resized, resized.notifications, Date.now(), notificationTickCmd);
    }

    if (msg.type === 'runtime-issue') {
      return pushRuntimeIssueToast(model, msg.issue, notificationTickCmd);
    }

    if (msg.type === 'notification-tick') {
      return tickNotificationState(model, msg.atMs, notificationTickCmd);
    }

    if (msg.type === 'time-tick') {
      const now = Date.now();
      const frameTime = now - model.lastFrameMs;
      const history = [...model.frameTimeHistory, frameTime].slice(-50);
      return [{
        ...model,
        time: msg.time,
        lastFrameMs: now,
        frameTimeMs: frameTime,
        frameTimeHistory: history,
      }, []];
    }

    // For any other message type, return the model unchanged.
    return [model, []];
  },
  view: (model) => {
    // Placeholder for view function. Render function is typically called here.
    // For now, returning empty to avoid errors.
  },
  routeRuntimeIssue: (issue) => ({ type: 'runtime-issue', issue }),
});
