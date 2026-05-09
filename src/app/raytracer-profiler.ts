import { basename, join } from 'node:path';
import { open, type FileHandle } from 'node:fs/promises';
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
  readonly fileHandle?: FileHandle;
}

export type ProfilerMsg =
  | { type: 'profiler-started'; filePath: string; fileHandle: FileHandle }
  | { type: 'profiler-stopped' };

export type ProfilerEffectMsg = ProfilerMsg | { type: 'runtime-issue'; issue: RuntimeIssue };

export function createInitialProfilerState(): ProfilerState {
  return { active: false };
}

export function reduceProfilerMsg(state: ProfilerState, msg: ProfilerMsg): ProfilerState {
  if (msg.type === 'profiler-started') {
    return { active: true, filePath: msg.filePath, fileHandle: msg.fileHandle };
  }
  if (msg.type === 'profiler-stopped') {
    return { active: false };
  }
  return state;
}

export function toggleProfiler(
  state: ProfilerState,
  workspaceRoot: string,
): [ProfilerState, Cmd<ProfilerEffectMsg>[]] {
  if (state.active && state.fileHandle != null) {
    const fileName = state.filePath ? basename(state.filePath) : 'profile.jsonl';
    // We deactivate immediately to prevent race conditions during close
    const nextState = { ...state, active: false };
    const activeHandle = state.fileHandle;
    return [nextState, [
      async (): Promise<ProfilerEffectMsg> => {
        try {
          await activeHandle.close();
          const stopped: ProfilerMsg = { type: 'profiler-stopped' };
          return stopped;
        } catch (err) {
          return {
            type: 'runtime-issue',
            issue: {
              message: `Failed to close profile: ${String(err)}`,
              level: 'error',
              source: 'command',
              atMs: Date.now(),
            },
          };
        }
      },
      (): ProfilerEffectMsg => {
        return {
          type: 'runtime-issue',
          issue: {
            message: `Profile trace saved to ${fileName}`,
            level: 'warning',
            source: 'command',
            atMs: Date.now(),
          },
        };
      },
    ]];
  }

  return [state, [
    async (): Promise<ProfilerEffectMsg> => {
      try {
        const fileName = `raytracer-profile-${Date.now()}.jsonl`;
        const filePath = join(workspaceRoot, fileName);
        const fileHandle = await open(filePath, 'a');
        const started: ProfilerMsg = { type: 'profiler-started', filePath, fileHandle };
        return started;
      } catch (err) {
        return {
          type: 'runtime-issue',
          issue: {
            message: `Failed to start profile: ${String(err)}`,
            level: 'error',
            source: 'command',
            atMs: Date.now(),
          },
        };
      }
    }
  ]];
}

export function streamProfilerFrame(
  state: ProfilerState,
  frame: ProfilerFrame,
): Cmd<ProfilerEffectMsg> | undefined {
  if (!state.active || state.fileHandle == null) {
    return undefined;
  }

  const activeHandle = state.fileHandle;
  return async (): Promise<ProfilerEffectMsg | undefined> => {
    try {
      await activeHandle.appendFile(`${JSON.stringify(frame)}\n`, 'utf8');
      return undefined;
    } catch (err) {
      return {
        type: 'runtime-issue',
        issue: {
          message: `Failed to stream profile: ${String(err)}`,
          level: 'error',
          source: 'command',
          atMs: Date.now(),
        },
      };
    }
  };
}
