import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';

export interface ProfilerFrame {
  readonly time: number;
  readonly frameTimeMs: number;
  readonly columns: number;
  readonly rows: number;
}

export interface ProfilerState {
  readonly active: boolean;
  readonly filePath?: string;
  readonly fileHandle?: ProfilerHandle;
}

export interface ProfilerHandle {
  readonly filePath: string;
  readonly append: (frame: ProfilerFrame) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface ProfilerTracePort {
  readonly nowMs: () => number;
  readonly beginTrace: (workspaceRoot: string) => Promise<ProfilerHandle>;
  readonly appendTraceFrame: (handle: ProfilerHandle, frame: ProfilerFrame) => Promise<void>;
  readonly endTrace: (handle: ProfilerHandle) => Promise<void>;
}

const PROFILER_MESSAGE_STARTED = 'profiler-started';
const PROFILER_MESSAGE_STOPPED = 'profiler-stopped';
const PROFILER_EFFECT_RUNTIME_ISSUE = 'runtime-issue';

export const ProfilerMessageTypes = Object.freeze({
  Started: PROFILER_MESSAGE_STARTED,
  Stopped: PROFILER_MESSAGE_STOPPED,
});

export type ProfilerMsg =
  | { type: typeof ProfilerMessageTypes.Started; filePath: string; fileHandle: ProfilerHandle }
  | { type: typeof ProfilerMessageTypes.Stopped };

export type ProfilerEffectMsg = ProfilerMsg | { type: typeof PROFILER_EFFECT_RUNTIME_ISSUE; issue: RuntimeIssue };

const ISSUE_LEVEL_ERROR = 'error';
const ISSUE_LEVEL_WARNING = 'warning';
const ISSUE_SOURCE_COMMAND = 'command';

export function createInitialProfilerState(): ProfilerState {
  return { active: false };
}

export function reduceProfilerMsg(state: ProfilerState, msg: ProfilerMsg): ProfilerState {
  if (msg.type === ProfilerMessageTypes.Started) {
    return { active: true, filePath: msg.filePath, fileHandle: msg.fileHandle };
  }
  if (msg.type === ProfilerMessageTypes.Stopped) {
    return { active: false };
  }
  return state;
}

export function toggleProfiler(
  state: ProfilerState,
  workspaceRoot: string,
  profiler: ProfilerTracePort,
): [ProfilerState, Cmd<ProfilerEffectMsg>[]] {
  if (state.active && state.fileHandle != null) {
    const nextState = { ...state, active: false };
    const activeHandle = state.fileHandle;
    return [nextState, [
      async (): Promise<ProfilerEffectMsg> => {
        try {
          await profiler.endTrace(activeHandle);
          return {
            type: PROFILER_EFFECT_RUNTIME_ISSUE,
            issue: {
              message: `Profile trace saved to ${activeHandle.filePath}`,
              level: ISSUE_LEVEL_WARNING,
              source: ISSUE_SOURCE_COMMAND,
              atMs: profiler.nowMs(),
            },
          };
        } catch (err) {
          return {
            type: PROFILER_EFFECT_RUNTIME_ISSUE,
            issue: {
              message: `Failed to close profile: ${String(err)}`,
              level: ISSUE_LEVEL_ERROR,
              source: ISSUE_SOURCE_COMMAND,
              atMs: profiler.nowMs(),
            },
          };
        }
      },
    ]];
  }

  return [state, [
    async (): Promise<ProfilerEffectMsg> => {
      try {
        const fileHandle = await profiler.beginTrace(workspaceRoot);
        const started: ProfilerMsg = { type: ProfilerMessageTypes.Started, filePath: fileHandle.filePath, fileHandle };
        return started;
      } catch (err) {
        return {
          type: PROFILER_EFFECT_RUNTIME_ISSUE,
          issue: {
            message: `Failed to start profile: ${String(err)}`,
            level: ISSUE_LEVEL_ERROR,
            source: ISSUE_SOURCE_COMMAND,
            atMs: profiler.nowMs(),
          },
        };
      }
    },
  ]];
}

export function streamProfilerFrame(
  state: ProfilerState,
  frame: ProfilerFrame,
  profiler: ProfilerTracePort,
): Cmd<ProfilerEffectMsg> | undefined {
  if (!state.active || state.fileHandle == null) {
    return undefined;
  }

  const activeHandle = state.fileHandle;
  return async (): Promise<ProfilerEffectMsg | undefined> => {
    try {
      await profiler.appendTraceFrame(activeHandle, frame);
      return undefined;
    } catch (err) {
      return {
        type: PROFILER_EFFECT_RUNTIME_ISSUE,
        issue: {
          message: `Failed to stream profile: ${String(err)}`,
          level: ISSUE_LEVEL_ERROR,
          source: ISSUE_SOURCE_COMMAND,
          atMs: profiler.nowMs(),
        },
      };
    }
  };
}
