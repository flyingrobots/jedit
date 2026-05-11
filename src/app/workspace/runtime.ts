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
import { reduceTitleCameraMotion, TITLE_CAMERA_MESSAGE } from '../title-camera-session.js';
import { ensureEditorVisible, editorViewport } from './editor-session.js';
import { updateFromKey } from './key-bindings.js';
import { updateFromMouse } from './mouse.js';
import { clamp01, clampIndex } from './viewport.js';
import { renderWorkspace } from './viewer.js';
import {
  reduceProfilerMsg,
  streamProfilerFrame,
  toggleProfiler,
  type ProfilerMsg,
  type ProfilerTracePort,
} from '../raytracer-profiler.js';
import { createInitialProfilerState } from '../raytracer-profiler.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { FileSystemPort } from '../../ports/file-system.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';

export interface WorkspaceRuntimeDependencies {
  initialColumns: number;
  initialRows: number;
  initialWorkingDirectory: string;
  fileSystem: FileSystemPort;
  editorFile: EditorFilePort;
  graftSession: GraftSessionPort;
  sourceHighlighter: SourceHighlighter;
  titleSceneLoader: TitleSceneLoaderPort;
  profiler: ProfilerTracePort;
  createTimeTickCmd: () => Cmd<WorkspaceMsg>;
  createNotificationTickCmd: () => Cmd<WorkspaceMsg>;
  createDrawerAnimationCmd: (kind: DrawerKind, from: number, to: number) => Cmd<WorkspaceMsg>[];
  initialModel: WorkspaceInitialModelSnapshot;
  nowMs: () => number;
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
      manageGraftLifecycle(deps.graftSession.closeConnection),
      deps.createTimeTickCmd(),
    ],
  ],
  update: (msg, model): [WorkspaceModel, Cmd<WorkspaceMsg>[]] => {
    const now = deps.nowMs();
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
      return applyNotificationState(
        resized,
        resized.notifications,
        now,
        deps.createNotificationTickCmd,
      );
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
      return tickNotificationState(model, msg.atMs, deps.createNotificationTickCmd);
    }

    if (msg.type === 'time-tick') {
      const frameTime = now - model.lastFrameMs;
      const nextModel = {
        ...model,
        time: msg.time,
        lastFrameMs: now,
        frameTimeMs: frameTime,
        frameTimeHistory: [...model.frameTimeHistory, frameTime].slice(-50),
      };
      const profilerStream = streamProfilerFrame(nextModel.profiler, {
        time: msg.time,
        frameTimeMs: frameTime,
        columns: nextModel.columns,
        rows: nextModel.rows,
      }, deps.profiler);
      return [nextModel, profilerStream == null ? [] : [profilerStream]];
    }

    if (msg.type === 'toggle-perf') {
      return [{ ...model, perfVisible: !model.perfVisible }, []];
    }

    if (msg.type === 'toggle-profiler') {
      const [nextProfiler, commands] = toggleProfiler(model.profiler, model.workspaceRoot, deps.profiler);
      return [{ ...model, profiler: nextProfiler }, commands];
    }

    if (msg.type === 'runtime-issue') {
      return pushRuntimeIssueToast(model, msg.issue, deps.createNotificationTickCmd);
    }

    if (isProfilerMsg(msg)) {
      return [{ ...model, profiler: reduceProfilerMsg(model.profiler, msg) }, []];
    }

    if (msg.type === 'mouse') {
      return updateFromMouse(msg, model, deps.sourceHighlighter);
    }

    if (msg.type !== 'key') {
      return [model, []];
    }

    return updateFromKey(
      msg,
      model,
      deps.nowMs,
      deps.createDrawerAnimationCmd,
      {
        fileSystem: deps.fileSystem,
        editorFile: deps.editorFile,
        sourceHighlighter: deps.sourceHighlighter,
        graftSession: deps.graftSession,
        titleSceneLoader: deps.titleSceneLoader,
      },
    );
  },
  view: (model) => renderWorkspace(model),
  routeRuntimeIssue: (issue) => ({ type: 'runtime-issue', issue }),
});


type WorkspaceRuntimeMsg = WorkspaceMsg | ResizeMsg | KeyMsg | MouseMsg;

function isProfilerMsg(msg: WorkspaceRuntimeMsg): msg is ProfilerMsg {
  return msg.type === 'profiler-started' || msg.type === 'profiler-stopped';
}
