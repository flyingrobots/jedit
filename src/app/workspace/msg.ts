import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { GraftInfo } from '../../ports/graft-session.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { TitleScene } from '../../ui/title-scene.js';
import type { ProfilerMsg } from '../raytracer-profiler.js';
import type { SourceHighlightMsg } from '../source-highlight-session.js';
import type { TitleCameraMotionMsg } from '../title-camera-session.js';
import type {
  WorkspaceTextCheckpointResult,
  WorkspaceTextEditResult,
  WorkspaceTextExportResult,
  WorkspaceTextOpenResult,
  WorkspaceTextReadCommandResult,
} from './workspace-text-results.js';

const WORKSPACE_MESSAGE_DRAWER_PROGRESS = 'drawer-progress';
const WORKSPACE_MESSAGE_GRAFT_INFO = 'graft-info';
const WORKSPACE_MESSAGE_LOAD_SCENE_RESULT = 'load-scene-result';
const WORKSPACE_MESSAGE_TOGGLE_PROFILER = 'toggle-profiler';
const WORKSPACE_MESSAGE_NOTIFICATION_TICK = 'notification-tick';
const WORKSPACE_MESSAGE_TIME_TICK = 'time-tick';
const WORKSPACE_MESSAGE_TOGGLE_PERF = 'toggle-perf';
const WORKSPACE_MESSAGE_RUNTIME_ISSUE = 'runtime-issue';
const WORKSPACE_MESSAGE_TEXT_OPEN_RESULT = 'text-open-result';
const WORKSPACE_MESSAGE_TEXT_EDIT_RESULT = 'text-edit-result';
const WORKSPACE_MESSAGE_TEXT_CHECKPOINT_RESULT = 'text-checkpoint-result';
const WORKSPACE_MESSAGE_TEXT_EXPORT_RESULT = 'text-export-result';
const WORKSPACE_MESSAGE_TEXT_READ_RESULT = 'text-read-result';
const WORKSPACE_INPUT_MESSAGE_RESIZE = 'resize';
const WORKSPACE_INPUT_MESSAGE_KEY = 'key';
const WORKSPACE_INPUT_MESSAGE_MOUSE = 'mouse';

export const WorkspaceMessageTypes = Object.freeze({
  DrawerProgress: WORKSPACE_MESSAGE_DRAWER_PROGRESS,
  GraftInfo: WORKSPACE_MESSAGE_GRAFT_INFO,
  LoadSceneResult: WORKSPACE_MESSAGE_LOAD_SCENE_RESULT,
  ToggleProfiler: WORKSPACE_MESSAGE_TOGGLE_PROFILER,
  NotificationTick: WORKSPACE_MESSAGE_NOTIFICATION_TICK,
  TimeTick: WORKSPACE_MESSAGE_TIME_TICK,
  TogglePerf: WORKSPACE_MESSAGE_TOGGLE_PERF,
  RuntimeIssue: WORKSPACE_MESSAGE_RUNTIME_ISSUE,
  TextOpenResult: WORKSPACE_MESSAGE_TEXT_OPEN_RESULT,
  TextEditResult: WORKSPACE_MESSAGE_TEXT_EDIT_RESULT,
  TextCheckpointResult: WORKSPACE_MESSAGE_TEXT_CHECKPOINT_RESULT,
  TextExportResult: WORKSPACE_MESSAGE_TEXT_EXPORT_RESULT,
  TextReadResult: WORKSPACE_MESSAGE_TEXT_READ_RESULT,
});

export const WorkspaceInputMessageTypes = Object.freeze({
  Resize: WORKSPACE_INPUT_MESSAGE_RESIZE,
  Key: WORKSPACE_INPUT_MESSAGE_KEY,
  Mouse: WORKSPACE_INPUT_MESSAGE_MOUSE,
});

export type WorkspaceMsg =
  | { type: typeof WorkspaceMessageTypes.DrawerProgress; kind: DrawerKind; value: number }
  | { type: typeof WorkspaceMessageTypes.GraftInfo; requestId: number; info: GraftInfo }
  | { type: typeof WorkspaceMessageTypes.LoadSceneResult; scene: TitleScene | undefined }
  | ProfilerMsg
  | { type: typeof WorkspaceMessageTypes.ToggleProfiler }
  | SourceHighlightMsg
  | TitleCameraMotionMsg
  | { type: typeof WorkspaceMessageTypes.NotificationTick; atMs: number }
  | { type: typeof WorkspaceMessageTypes.TimeTick; time: number }
  | { type: typeof WorkspaceMessageTypes.TogglePerf }
  | { type: typeof WorkspaceMessageTypes.RuntimeIssue; issue: RuntimeIssue }
  | { type: typeof WorkspaceMessageTypes.TextOpenResult; requestId: number; result: WorkspaceTextOpenResult }
  | { type: typeof WorkspaceMessageTypes.TextEditResult; requestId: number; result: WorkspaceTextEditResult }
  | { type: typeof WorkspaceMessageTypes.TextCheckpointResult; requestId: number; result: WorkspaceTextCheckpointResult }
  | { type: typeof WorkspaceMessageTypes.TextExportResult; requestId: number; result: WorkspaceTextExportResult }
  | { type: typeof WorkspaceMessageTypes.TextReadResult; requestId: number; result: WorkspaceTextReadCommandResult };

export function workspaceSourceHighlightMessage(msg: SourceHighlightMsg): WorkspaceMsg {
  return msg;
}
