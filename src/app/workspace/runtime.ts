import { createInitialModel, recoverJeditWorkspaceFromWsc } from "./init.js";
import type { WorkspaceModel } from "./model.js";
import {
  applyNotificationState,
  pushRuntimeIssueToast,
  tickNotificationState,
} from "../../ui/feedback.js";
import {
  reduceSourceHighlightMsg,
  SOURCE_HIGHLIGHT_MESSAGE,
} from "../source-highlight-session.js";
import {
  createTitleCameraState,
  reduceTitleCameraMotion,
  TITLE_CAMERA_MESSAGE,
} from "../title-camera-session.js";
import { advanceTitleCameraFrame } from "../title-camera-input.js";
import { ensureEditorVisible, editorViewport } from "./editor-session.js";
import { updateFromKey } from "./key-bindings.js";
import { updateFromMouse } from "./mouse.js";
import { createWorkspaceRenderer } from "./viewer.js";
import {
  createInitialProfilerState,
  ProfilerMessageTypes,
  reduceProfilerMsg,
  streamProfilerFrame,
  toggleProfiler,
  type ProfilerMsg,
} from "../raytracer-profiler.js";
import {
  WorkspaceInputMessageTypes,
  WorkspaceMessageTypes,
  type WorkspaceMsg,
} from "./msg.js";
import {
  applyDrawerProgress,
  applyGraftInfo,
  applyStartupFileDrawerProgress,
  applyStartupIntroTime,
  applyWorkspaceTextMessage,
} from "./workspace-state-reducers.js";
import type {
  WorkspaceRuntime,
  WorkspaceRuntimeDependencies,
  WorkspaceRuntimeMsg,
  WorkspaceRuntimeResult,
  WorkspaceResizeMsg,
} from "./workspace-runtime-dependencies.js";

export { WorkspaceInputMessageTypes, WorkspaceMessageTypes } from "./msg.js";

const FRAME_TIME_HISTORY_SIZE = 50;

export const createWorkspaceRuntime = (
  deps: WorkspaceRuntimeDependencies,
): WorkspaceRuntime => {
  const renderWorkspace = createWorkspaceRenderer();
  return {
    init: () => {
      const wscStartupRecovery = recoverJeditWorkspaceFromWsc(
        deps.wscWorkspaceStore,
      );
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
        [deps.createTimeTickCmd()],
      ];
    },
    update: (msg, model) => updateWorkspaceRuntime(deps, msg, model),
    view: (model) => renderWorkspace(model),
    routeRuntimeIssue: (issue) => ({
      type: WorkspaceMessageTypes.RuntimeIssue,
      issue,
    }),
  };
};

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
  return applyNotificationState(
    resized,
    resized.notifications,
    deps.nowMs(),
    deps.createNotificationTickCmd,
  );
}

function resizeWorkspaceModel(
  model: WorkspaceModel,
  msg: WorkspaceResizeMsg,
): WorkspaceModel {
  const viewport = editorViewport({
    ...model,
    columns: msg.columns,
    rows: msg.rows,
  });
  return {
    ...model,
    columns: msg.columns,
    rows: msg.rows,
    editor:
      model.editor == null
        ? undefined
        : ensureEditorVisible(model.editor, viewport.width, viewport.height),
  };
}

function updateWorkspaceStateMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  const animation = updateAnimationStateMessage(msg, model);
  if (animation != null) {
    return animation;
  }
  if (msg.type === WorkspaceMessageTypes.GraftInfo) {
    return updateGraftInfoMessage(msg, model);
  }
  if (msg.type === WorkspaceMessageTypes.LoadSceneResult) {
    return [applySceneLoadResult(model, msg), []];
  }
  if (msg.type === SOURCE_HIGHLIGHT_MESSAGE) {
    return [reduceSourceHighlightMsg(model, msg), []];
  }
  const text = isWorkspaceMsg(msg)
    ? applyWorkspaceTextMessage(deps, msg, model)
    : undefined;
  if (text != null) {
    return text;
  }
  return msg.type === TITLE_CAMERA_MESSAGE.Frame
    ? [
        {
          ...model,
          titleCamera: reduceTitleCameraMotion(model.titleCamera, msg),
        },
        [],
      ]
    : undefined;
}

function updateAnimationStateMessage(
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.DrawerProgress) {
    return [applyDrawerProgress(model, msg.kind, msg.value), []];
  }
  return msg.type === WorkspaceMessageTypes.StartupFileDrawerProgress
    ? [applyStartupFileDrawerProgress(model, msg.value), []]
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
  return (
    msg.type !== WorkspaceInputMessageTypes.Resize &&
    msg.type !== WorkspaceInputMessageTypes.Key &&
    msg.type !== WorkspaceInputMessageTypes.Mouse
  );
}

function applySceneLoadResult(
  model: WorkspaceModel,
  msg: Extract<
    WorkspaceMsg,
    { type: typeof WorkspaceMessageTypes.LoadSceneResult }
  >,
): WorkspaceModel {
  return {
    ...model,
    sceneOverride: msg.scene,
    titleSceneName: msg.scene == null ? undefined : msg.sceneName,
    titleCamera:
      msg.scene == null
        ? model.titleCamera
        : createTitleCameraState(msg.scene.camera),
    titleCameraInput: {},
  };
}

function updateWorkspaceEffectMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.NotificationTick) {
    return tickNotificationState(
      model,
      msg.atMs,
      deps.createNotificationTickCmd,
    );
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
  const nextModel = advanceTitleCameraFromFrame(
    applyStartupIntroTime(runtimeFrameModel(model, time, now, frameTime)),
    now,
    frameTime,
  );
  const startupDrawerCommands = startupFileDrawerIntroCommands(
    deps,
    model,
    nextModel,
  );
  const profilerStream = streamProfilerFrame(
    nextModel.profiler,
    {
      time,
      frameTimeMs: frameTime,
      columns: nextModel.columns,
      rows: nextModel.rows,
    },
    deps.profiler,
  );
  return [
    nextModel,
    [
      ...startupDrawerCommands,
      ...(profilerStream == null ? [] : [profilerStream]),
    ],
  ];
}

function runtimeFrameModel(
  model: WorkspaceModel,
  time: number,
  now: number,
  frameTime: number,
): WorkspaceModel {
  return {
    ...model,
    time,
    lastFrameMs: now,
    frameTimeMs: frameTime,
    frameTimeHistory: [...model.frameTimeHistory, frameTime].slice(
      -FRAME_TIME_HISTORY_SIZE,
    ),
  };
}

function advanceTitleCameraFromFrame(
  model: WorkspaceModel,
  nowMs: number,
  frameTimeMs: number,
): WorkspaceModel {
  if (!titleCameraFrameInputEnabled(model)) {
    return { ...model, titleCameraInput: {} };
  }
  const advanced = advanceTitleCameraFrame(
    model.titleCamera,
    model.titleCameraInput,
    nowMs,
    frameTimeMs,
  );
  return {
    ...model,
    titleCamera: advanced.state,
    titleCameraInput: advanced.input,
  };
}

function titleCameraFrameInputEnabled(model: WorkspaceModel): boolean {
  return (
    model.editor == null &&
    !model.settingsOpen &&
    !model.scenePickerOpen &&
    !model.startupFileModalOpen &&
    !model.quitConfirmOpen &&
    !model.commandLine.active
  );
}

function startupFileDrawerIntroCommands(
  deps: WorkspaceRuntimeDependencies,
  previous: WorkspaceModel,
  next: WorkspaceModel,
): WorkspaceRuntimeResult[1] {
  return !previous.startupFileModalOpen && next.startupFileModalOpen
    ? deps.createStartupFileDrawerAnimationCmd(
        previous.startupFileDrawerProgress,
        1,
      )
    : [];
}

function updateProfilerOrIssueMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.ToggleProfiler) {
    const [nextProfiler, commands] = toggleProfiler(
      model.profiler,
      model.workspaceRoot,
      deps.profiler,
    );
    return [{ ...model, profiler: nextProfiler }, commands];
  }
  if (msg.type === WorkspaceMessageTypes.RuntimeIssue) {
    return pushRuntimeIssueToast(
      model,
      msg.issue,
      deps.createNotificationTickCmd,
    );
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
    createStartupFileDrawerAnimationCmd:
      deps.createStartupFileDrawerAnimationCmd,
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
  return (
    msg.type === ProfilerMessageTypes.Started ||
    msg.type === ProfilerMessageTypes.Stopped
  );
}
