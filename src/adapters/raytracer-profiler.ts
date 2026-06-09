import { dirname, join } from 'node:path';
import { mkdir, open, type FileHandle } from 'node:fs/promises';
import {
  type ProfilerFrame,
  type ProfilerHandle,
  type ProfilerMemorySample,
  type ProfilerTracePort,
} from '../app/raytracer-profiler.js';

export const JEDIT_PERF_SESSION_RELATIVE_PATH = join('.jedit', 'perf-session.jsonl');

const PROFILE_FILE_OPEN_MODE = 'w';
const PROFILE_FILE_ENCODING = 'utf8';
const PROFILE_FRAME_LINE_SUFFIX = '\n';
const PROFILE_RECORD_SESSION = 'session';
const PROFILE_RECORD_FRAME = 'frame';

export function createRaytracerProfilerPort(nowMs: () => number): ProfilerTracePort {
  return {
    nowMs,
    memoryUsage: () => profilerMemorySample(process.memoryUsage()),
    beginTrace: async (workspaceRoot): Promise<ProfilerHandle> => {
      const filePath = join(workspaceRoot, JEDIT_PERF_SESSION_RELATIVE_PATH);
      await mkdir(dirname(filePath), { recursive: true });
      const handle = await open(filePath, PROFILE_FILE_OPEN_MODE);
      await handle.appendFile(
        `${JSON.stringify(sessionRecord(workspaceRoot, nowMs()))}${PROFILE_FRAME_LINE_SUFFIX}`,
        PROFILE_FILE_ENCODING,
      );
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

function sessionRecord(workspaceRoot: string, startedAtMs: number) {
  return {
    kind: PROFILE_RECORD_SESSION,
    startedAtMs,
    workspaceRoot,
  };
}

function profilerMemorySample(memory: NodeJS.MemoryUsage): ProfilerMemorySample {
  return {
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    rssBytes: memory.rss,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
  };
}

function toProfilerHandle(filePath: string, fileHandle: FileHandle): ProfilerHandle {
  return {
    filePath,
    append: async (frame: ProfilerFrame) => {
      await fileHandle.appendFile(
        `${JSON.stringify(frameRecord(frame))}${PROFILE_FRAME_LINE_SUFFIX}`,
        PROFILE_FILE_ENCODING,
      );
    },
    close: async () => {
      await fileHandle.close();
    },
  };
}

function frameRecord(frame: ProfilerFrame) {
  return {
    kind: PROFILE_RECORD_FRAME,
    ...frame,
  };
}
