import type { Cmd, KeyMsg, MouseMsg, ResizeMsg, RuntimeIssue } from '@flyingrobots/bijou-tui';
import { createInitialModel } from './init.js';
import type { WorkspaceInitialModelSnapshot } from './init.js';
import { manageGraftLifecycle } from './graft.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
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
import { clamp01, clampIndex } from './viewport.js';
import { renderWorkspace } from './viewer.js';
import {
  ProfilerMessageTypes,
  reduceProfilerMsg,
  streamProfilerFrame,
  toggleProfiler,
  type ProfilerMsg,
  type ProfilerTracePort,
} from '../raytracer-profiler.js';
import { createInitialProfilerState } from '../raytracer-profiler.js';
import { DrawerKinds, type DrawerKind } from '../../ui/drawer-layout.js';
import type { FileSystemPort } from '../../ports/file-system.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';
import { WorkspaceInputMessageTypes, WorkspaceMessageTypes } from './msg.js';

export { WorkspaceInputMessageTypes, WorkspaceMessageTypes } from './msg.js';

const FRAME_TIME_HISTORY_SIZE = 50;

export interface WorkspaceRuntimeDependencies {
  readonly initialColumns: number;
  readonly initialRows: number;
  readonly initialWorkingDirectory: string;
  readonly fileSystem: FileSystemPort;
  readonly editorFile: EditorFilePort;
  readonly graftSession: GraftSessionPort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly titleSceneLoader: TitleSceneLoaderPort;
  readonly profiler: ProfilerTracePort;
  readonly createTimeTickCmd: () => Cmd<WorkspaceMsg>;
  readonly createNotificationTickCmd: () => Cmd<WorkspaceMsg>;
  readonly createDrawerAnimationCmd: (kind: DrawerKind, from: number, to: number) => Cmd<WorkspaceMsg>[];
  readonly initialModel: WorkspaceInitialModelSnapshot;
  readonly nowMs: () => number;
}

export interface WorkspaceRuntime {
  init: () => [WorkspaceModel, Cmd<WorkspaceMsg>[]];
  update: (msg: WorkspaceRuntimeMsg, model: WorkspaceModel) => [WorkspaceModel, Cmd<WorkspaceMsg>[]];
  view: (model: WorkspaceModel) => ReturnType<typeof renderWorkspace>;
  routeRuntimeIssue: (issue: RuntimeIssue) => WorkspaceMsg;
}

export const createWorkspaceRuntime = (deps: WorkspaceRuntimeDependencies): WorkspaceRuntime => ({
  init: () => [
    {
      ...createInitialModel(
        deps.initialWorkingDirectory,
        deps.initialColumns,
        deps.initialRows,
        {
          ...deps.initialModel,
          nowMs: deps.initialModel.nowMs ?? deps.nowMs(),
        },
      ),
      profiler: createInitialProfilerState(),
    },
    [
      manageGraftLifecycle(deps.graftSession.closeConnection, deps.nowMs),
      deps.createTimeTickCmd(),
    ],
  ],
  update: (msg, model): [WorkspaceModel, Cmd<WorkspaceMsg>[]] => {
    const now = deps.nowMs();
    if (msg.type === WorkspaceInputMessageTypes.Resize) {
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
      return applyNotificationState(
        resized,
        resized.notifications,
        now,
        deps.createNotificationTickCmd,
      );
    }

    if (msg.type === WorkspaceMessageTypes.DrawerProgress) {
      const nextModel: WorkspaceModel = msg.kind === DrawerKinds.Files
        ? { ...model, fileDrawerProgress: clamp01(msg.value) }
        : { ...model, graftDrawerProgress: clamp01(msg.value) };
      return [nextModel, []];
    }

    if (msg.type === WorkspaceMessageTypes.GraftInfo) {
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

    if (msg.type === WorkspaceMessageTypes.LoadSceneResult) {
      return [{
        ...model,
        sceneOverride: msg.scene,
        titleCamera: msg.scene == null ? model.titleCamera : createTitleCameraState(msg.scene.camera),
      }, []];
    }

    if (msg.type === SOURCE_HIGHLIGHT_MESSAGE) {
      return [reduceSourceHighlightMsg(model, msg), []];
    }

    if (msg.type === TITLE_CAMERA_MESSAGE.Frame) {
      return [{ ...model, titleCamera: reduceTitleCameraMotion(model.titleCamera, msg) }, []];
    }

    if (msg.type === WorkspaceMessageTypes.NotificationTick) {
      return tickNotificationState(model, msg.atMs, deps.createNotificationTickCmd);
    }

    if (msg.type === WorkspaceMessageTypes.TimeTick) {
      const frameTime = now - model.lastFrameMs;
      const nextModel = {
        ...model,
        time: msg.time,
        lastFrameMs: now,
        frameTimeMs: frameTime,
        frameTimeHistory: [...model.frameTimeHistory, frameTime].slice(-FRAME_TIME_HISTORY_SIZE),
      };
      const profilerStream = streamProfilerFrame(nextModel.profiler, {
        time: msg.time,
        frameTimeMs: frameTime,
        columns: nextModel.columns,
        rows: nextModel.rows,
      }, deps.profiler);
      return [nextModel, profilerStream == null ? [] : [profilerStream]];
    }

    if (msg.type === WorkspaceMessageTypes.TogglePerf) {
      return [{ ...model, perfVisible: !model.perfVisible }, []];
    }

    if (msg.type === WorkspaceMessageTypes.ToggleProfiler) {
      const [nextProfiler, commands] = toggleProfiler(model.profiler, model.workspaceRoot, deps.profiler);
      return [{ ...model, profiler: nextProfiler }, commands];
    }

    if (msg.type === WorkspaceMessageTypes.RuntimeIssue) {
      return pushRuntimeIssueToast(model, msg.issue, deps.createNotificationTickCmd);
    }

    if (isProfilerMsg(msg)) {
      return [{ ...model, profiler: reduceProfilerMsg(model.profiler, msg) }, []];
    }

    if (msg.type === WorkspaceInputMessageTypes.Mouse) {
      return updateFromMouse(msg, model, deps.sourceHighlighter);
    }

    if (msg.type !== WorkspaceInputMessageTypes.Key) {
      return [model, []];
    }

    return updateFromKey(
      msg,
      model,
      {
        nowMs: deps.nowMs,
        createDrawerAnimationCmd: deps.createDrawerAnimationCmd,
        createNotificationTickCmd: deps.createNotificationTickCmd,
        deps: {
          fileSystem: deps.fileSystem,
          editorFile: deps.editorFile,
          sourceHighlighter: deps.sourceHighlighter,
          graftSession: deps.graftSession,
          titleSceneLoader: deps.titleSceneLoader,
        },
      },
    );
  },
  view: (model) => renderWorkspace(model),
  routeRuntimeIssue: (issue) => ({ type: WorkspaceMessageTypes.RuntimeIssue, issue }),
});


type WorkspaceRuntimeMsg = WorkspaceMsg | ResizeMsg | KeyMsg | MouseMsg;

function isProfilerMsg(msg: WorkspaceRuntimeMsg): msg is ProfilerMsg {
  return msg.type === ProfilerMessageTypes.Started || msg.type === ProfilerMessageTypes.Stopped;
}
