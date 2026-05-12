import { join } from 'node:path';
import { open, type FileHandle } from 'node:fs/promises';
import {
  type ProfilerFrame,
  type ProfilerHandle,
  type ProfilerTracePort,
} from '../app/raytracer-profiler.js';

const PROFILE_FILE_EXTENSION = 'jsonl';
const PROFILE_FILE_PREFIX = 'raytracer-profile';
const PROFILE_FILE_SEPARATOR = '-';
const PROFILE_FILE_PREFIX_SEPARATOR = '.';
const PROFILE_FILE_NAME_SUFFIX = `${PROFILE_FILE_PREFIX_SEPARATOR}${PROFILE_FILE_EXTENSION}`;
const PROFILE_FILE_OPEN_MODE = 'a';
const PROFILE_FILE_ENCODING = 'utf8';
const PROFILE_FRAME_LINE_SUFFIX = '\n';

export function createRaytracerProfilerPort(nowMs: () => number): ProfilerTracePort {
  return {
    nowMs,
    beginTrace: async (workspaceRoot): Promise<ProfilerHandle> => {
      const fileName = `${PROFILE_FILE_PREFIX}${PROFILE_FILE_SEPARATOR}${nowMs()}${PROFILE_FILE_NAME_SUFFIX}`;
      const filePath = join(workspaceRoot, fileName);
      const handle = await open(filePath, PROFILE_FILE_OPEN_MODE);
      return toProfilerHandle(filePath, handle);
    },
    appendTraceFrame: async (traceHandle, frame) => {
      await traceHandle.append(frame);
    },
    endTrace: async (traceHandle) => {
      await traceHandle.close();
    },
  };
}

function toProfilerHandle(filePath: string, fileHandle: FileHandle): ProfilerHandle {
  return {
    filePath,
    append: async (frame: ProfilerFrame) => {
      await fileHandle.appendFile(`${JSON.stringify(frame)}${PROFILE_FRAME_LINE_SUFFIX}`, PROFILE_FILE_ENCODING);
    },
    close: async () => {
      await fileHandle.close();
    },
  };
}
