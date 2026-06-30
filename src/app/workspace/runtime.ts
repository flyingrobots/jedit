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
import { ensureEditorVisible, editorViewport } from "./editor-session.js";
import { updateFromKey } from "./key-bindings.js";
import { updateFromMouse } from "./mouse.js";
import { createWorkspaceRenderer } from "./viewer.js";
import { applyWorkspaceCommandLineFilePreviewResult } from "./command-completion-preview.js";
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
  applyGraftDiagnostics,
  applyGraftInfo,
  applyStartupFileDrawerProgress,
  applyStartupIntroTime,
  applyWorkspaceTextMessage,
  applyWorkspaceWhyRangeResult,
  syncActiveWorkspaceBufferRecord,
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
      const model = {
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
      };
      return [model, initialRuntimeCommands(deps, model)];
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
  return syncWorkspaceRuntimeResult(updateWorkspaceRuntimeState(deps, msg, model));
}

function updateWorkspaceRuntimeState(
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

function syncWorkspaceRuntimeResult(result: WorkspaceRuntimeResult): WorkspaceRuntimeResult {
  return [syncActiveWorkspaceBufferRecord(result[0]), result[1]];
}

function initialRuntimeCommands(
  deps: WorkspaceRuntimeDependencies,
  model: WorkspaceModel,
): WorkspaceRuntimeResult[1] {
  return [...startupProfilerCommands(deps, model), deps.createTimeTickCmd()];
}

function startupProfilerCommands(
  deps: WorkspaceRuntimeDependencies,
  model: WorkspaceModel,
): WorkspaceRuntimeResult[1] {
  if (!deps.profileOnStartup) {
    return [];
  }
  const [, commands] = toggleProfiler(
    model.profiler,
    model.workspaceRoot,
    deps.profiler,
  );
  return commands;
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
  if (msg.type === WorkspaceMessageTypes.GraftDiagnostics) {
    return [applyGraftDiagnostics(model, msg.requestId, msg.report), []];
  }
  const generated = updateGeneratedStateMessage(msg, model);
  if (generated != null) {
    return generated;
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

function updateGeneratedStateMessage(
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.LoadSceneResult) {
    return [applySceneLoadResult(model, msg), []];
  }
  if (msg.type === SOURCE_HIGHLIGHT_MESSAGE) {
    return [reduceSourceHighlightMsg(model, msg), []];
  }
  return msg.type === WorkspaceMessageTypes.CommandLineFilePreviewResult
    ? [applyWorkspaceCommandLineFilePreviewResult(model, msg), []]
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
  };
}

function updateWorkspaceEffectMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceRuntimeMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  if (msg.type === WorkspaceMessageTypes.WhyRangeResult) {
    return applyWorkspaceWhyRangeResult(deps, msg, model);
  }
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
  const nextModel = applyStartupIntroTime({
    ...model,
    time,
    lastFrameMs: now,
    frameTimeMs: frameTime,
    frameTimeHistory: [...model.frameTimeHistory, frameTime].slice(
      -FRAME_TIME_HISTORY_SIZE,
    ),
  });
  const startupDrawerCommands = startupFileDrawerIntroCommands(
    deps,
    model,
    nextModel,
  );
  const profilerStream = activeProfilerStreamCommand(
    deps,
    time,
    frameTime,
    nextModel,
  );
  return [
    nextModel,
    [
      ...startupDrawerCommands,
      ...(profilerStream == null ? [] : [profilerStream]),
    ],
  ];
}

function activeProfilerStreamCommand(
  deps: WorkspaceRuntimeDependencies,
  time: number,
  frameTime: number,
  model: WorkspaceModel,
) {
  if (!model.profiler.active || model.profiler.fileHandle == null) {
    return undefined;
  }
  return streamProfilerFrame(
    model.profiler,
    {
      time,
      frameTimeMs: frameTime,
      columns: model.columns,
      rows: model.rows,
      memory: deps.profiler.memoryUsage(),
    },
    deps.profiler,
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
      graftDiagnostics: deps.graftDiagnostics,
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
