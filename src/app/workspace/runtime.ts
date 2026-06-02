import { createInitialModel, recoverJeditWorkspaceFromWsc } from './init.js';
import { manageGraftLifecycle } from './graft.js';
import type { WorkspaceModel } from './model.js';
import {
  applyNotificationState,
  pushRuntimeIssueToast,
  tickNotificationState,
} from '../../ui/feedback.js';
import { reduceSourceHighlightMsg, SOURCE_HIGHLIGHT_MESSAGE } from '../source-highlight-session.js';
import { createTitleCameraState, reduceTitleCameraMotion, TITLE_CAMERA_MESSAGE } from '../title-camera-session.js';
import { ensureEditorVisible, editorViewport } from './editor-session.js';
import { updateFromKey } from './key-bindings.js';
import { updateFromMouse } from './mouse.js';
import { renderWorkspace } from './viewer.js';
import {
  createInitialProfilerState,
  ProfilerMessageTypes,
  reduceProfilerMsg,
  streamProfilerFrame,
  toggleProfiler,
  type ProfilerMsg,
} from '../raytracer-profiler.js';
import { WorkspaceInputMessageTypes, WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import { applyDrawerProgress, applyGraftInfo, applyWorkspaceTextMessage } from './workspace-state-reducers.js';
import type {
  WorkspaceRuntime,
  WorkspaceRuntimeDependencies,
  WorkspaceRuntimeMsg,
  WorkspaceRuntimeResult,
  WorkspaceResizeMsg,
} from './workspace-runtime-dependencies.js';

export { WorkspaceInputMessageTypes, WorkspaceMessageTypes } from './msg.js';

const FRAME_TIME_HISTORY_SIZE = 50;

export const createWorkspaceRuntime = (deps: WorkspaceRuntimeDependencies): WorkspaceRuntime => ({
  init: () => {
    const wscStartupRecovery = recoverJeditWorkspaceFromWsc(deps.wscWorkspaceStore);
    return [
      {
        ...createInitialModel(
          deps.initialWorkingDirectory,
          deps.initialColumns,
          deps.initialRows,
          {
            ...deps.initialModel,
            nowMs: deps.initialModel.nowMs ?? deps.nowMs(),
            wscStartupRecovery,
          },
        ),
        profiler: createInitialProfilerState(),
      },
      [
        manageGraftLifecycle(deps.graftSession.closeConnection, deps.nowMs),
        deps.createTimeTickCmd(),
      ],
    ];
  },
  update: (msg, model) => updateWorkspaceRuntime(deps, msg, model),
  view: (model) => renderWorkspace(model),
  routeRuntimeIssue: (issue) => ({ type: WorkspaceMessageTypes.RuntimeIssue, issue }),
});

function updateWorkspaceRuntime(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const resized = updateResizeMessage(deps, msg, model);
  if (resized != null) {
    return resized;
  }
  const state = updateWorkspaceStateMessage(deps, msg, model);
  if (state != null) {
    return state;
  }
  const effects = updateWorkspaceEffectMessage(deps, msg, model);
  if (effects != null) {
    return effects;
  }
  return updateWorkspaceInputMessage(deps, msg, model);
}

function updateResizeMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type !== WorkspaceInputMessageTypes.Resize) {
    return undefined;
  }
  const resized = resizeWorkspaceModel(model, msg);
  return applyNotificationState(resized, resized.notifications, deps.nowMs(), deps.createNotificationTickCmd);
}

function resizeWorkspaceModel(model: WorkspaceModel, msg: WorkspaceResizeMsg): WorkspaceModel {
  const viewport = editorViewport({
    ...model,
    columns: msg.columns,
    rows: msg.rows,
  });
  return {
    ...model,
    columns: msg.columns,
    rows: msg.rows,
    editor: model.editor == null
      ? undefined
      : ensureEditorVisible(model.editor, viewport.width, viewport.height),
  };
}

function updateWorkspaceStateMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.DrawerProgress) {
    return [applyDrawerProgress(model, msg.kind, msg.value), []];
  }
  if (msg.type === WorkspaceMessageTypes.GraftInfo) {
    return updateGraftInfoMessage(msg, model);
  }
  if (msg.type === WorkspaceMessageTypes.LoadSceneResult) {
    return [applySceneLoadResult(model, msg.scene), []];
  }
  if (msg.type === SOURCE_HIGHLIGHT_MESSAGE) {
    return [reduceSourceHighlightMsg(model, msg), []];
  }
  const text = isWorkspaceMsg(msg) ? applyWorkspaceTextMessage(deps, msg, model) : undefined;
  if (text != null) {
    return text;
  }
  return msg.type === TITLE_CAMERA_MESSAGE.Frame
    ? [{ ...model, titleCamera: reduceTitleCameraMotion(model.titleCamera, msg) }, []]
    : undefined;
}

function updateGraftInfoMessage(
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.GraftInfo }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  return msg.requestId === model.graftRequestId
    ? [applyGraftInfo(model, msg.info), []]
    : [model, []];
}

function isWorkspaceMsg(msg: WorkspaceRuntimeMsg): msg is WorkspaceMsg {
  return msg.type !== WorkspaceInputMessageTypes.Resize
    && msg.type !== WorkspaceInputMessageTypes.Key
    && msg.type !== WorkspaceInputMessageTypes.Mouse;
}

function applySceneLoadResult(
  model: WorkspaceModel,
  scene: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.LoadSceneResult }>['scene'],
): WorkspaceModel {
  return {
    ...model,
    sceneOverride: scene,
    titleCamera: scene == null ? model.titleCamera : createTitleCameraState(scene.camera),
  };
}

function updateWorkspaceEffectMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.NotificationTick) {
    return tickNotificationState(model, msg.atMs, deps.createNotificationTickCmd);
  }
  if (msg.type === WorkspaceMessageTypes.TimeTick) {
    return updateTimeTickMessage(deps, msg.time, model);
  }
  if (msg.type === WorkspaceMessageTypes.TogglePerf) {
    return [{ ...model, perfVisible: !model.perfVisible }, []];
  }
  return updateProfilerOrIssueMessage(deps, msg, model);
}

function updateTimeTickMessage(
  deps: WorkspaceRuntimeDependencies,
  time: number,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const now = deps.nowMs();
  const frameTime = now - model.lastFrameMs;
  const nextModel = {
    ...model,
    time,
    lastFrameMs: now,
    frameTimeMs: frameTime,
    frameTimeHistory: [...model.frameTimeHistory, frameTime].slice(-FRAME_TIME_HISTORY_SIZE),
  };
  const profilerStream = streamProfilerFrame(nextModel.profiler, {
    time,
    frameTimeMs: frameTime,
    columns: nextModel.columns,
    rows: nextModel.rows,
  }, deps.profiler);
  return [nextModel, profilerStream == null ? [] : [profilerStream]];
}

function updateProfilerOrIssueMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.ToggleProfiler) {
    const [nextProfiler, commands] = toggleProfiler(model.profiler, model.workspaceRoot, deps.profiler);
    return [{ ...model, profiler: nextProfiler }, commands];
  }
  if (msg.type === WorkspaceMessageTypes.RuntimeIssue) {
    return pushRuntimeIssueToast(model, msg.issue, deps.createNotificationTickCmd);
  }
  return isProfilerMsg(msg)
    ? [{ ...model, profiler: reduceProfilerMsg(model.profiler, msg) }, []]
    : undefined;
}

function updateWorkspaceInputMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  if (msg.type === WorkspaceInputMessageTypes.Mouse) {
    return updateFromMouse(msg, model, deps.sourceHighlighter);
  }
  return msg.type === WorkspaceInputMessageTypes.Key
    ? updateFromKey(msg, model, workspaceKeyDeps(deps))
    : [model, []];
}

function workspaceKeyDeps(deps: WorkspaceRuntimeDependencies) {
  return {
    nowMs: deps.nowMs,
    createDrawerAnimationCmd: deps.createDrawerAnimationCmd,
    createNotificationTickCmd: deps.createNotificationTickCmd,
    deps: {
      fileSystem: deps.fileSystem,
      editorFile: deps.editorFile,
      sourceHighlighter: deps.sourceHighlighter,
      graftSession: deps.graftSession,
      titleSceneLoader: deps.titleSceneLoader,
      productionTextSession: deps.productionTextSession,
    },
  };
}

function isProfilerMsg(msg: WorkspaceRuntimeMsg): msg is ProfilerMsg {
  return msg.type === ProfilerMessageTypes.Started || msg.type === ProfilerMessageTypes.Stopped;
}
