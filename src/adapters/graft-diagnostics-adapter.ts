import {
  spawn,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process';
import {
  GRAFT_DIAGNOSTIC_STATUS,
  type FailedGraftDiagnosticsRequest,
  type GraftDiagnosticRow,
  type GraftDiagnosticsPort,
  type GraftDiagnosticsReport,
} from '../ports/graft-diagnostics.js';
import type {
  GraftProcessRunRequest,
  GraftProcessRunResult,
} from './graft-source-highlighter.js';

const COLORFUL_CLI_COMMAND = 'colorful';
const PROCESS_RUNNER_ENCODING = 'utf8';
const PROCESS_STDIO_PIPE = 'pipe';
const PROCESS_RUNNER_EMPTY_OUTPUT = '';
const PROCESS_SUCCESS_STATUS = 0;
const PROCESS_SIGNAL_KILL = 'SIGKILL';
const COLORFUL_VERSION_ARGS: readonly string[] = ['--version'];
const COLORFUL_VERSION_TIMEOUT_MS = 5000;
const BYTES_PER_KIBIBYTE = 1024;
const COLORFUL_VERSION_MAX_BUFFER_BYTES = 64 * BYTES_PER_KIBIBYTE;
const GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION = '0.10.1';
const DIAGNOSTICS_TITLE = 'Graft diagnostics';
const DIAGNOSTICS_SUMMARY_ACTIVE = 'Colorful prose projection is active.';
const DIAGNOSTICS_SUMMARY_INACTIVE = 'Colorful prose projection is inactive.';
const DIAGNOSTICS_SUMMARY_FAILED = 'Graft diagnostics failed.';
const DIAGNOSTICS_LABEL_GRAFT = 'Graft package';
const DIAGNOSTICS_LABEL_PARSER = 'Parser runtime';
const DIAGNOSTICS_LABEL_COMMAND = 'Colorful command';
const DIAGNOSTICS_LABEL_MINIMUM = 'Colorful minimum';
const DIAGNOSTICS_LABEL_CLI = 'Colorful CLI';
const DIAGNOSTICS_LABEL_PROJECTION = 'Prose projection';
const DIAGNOSTICS_VALUE_READY = 'ready';
const DIAGNOSTICS_VALUE_COLD = 'cold';
const DIAGNOSTICS_VALUE_ACTIVE = 'active';
const DIAGNOSTICS_VALUE_INACTIVE = 'inactive';
const DIAGNOSTICS_VALUE_UNAVAILABLE = 'unavailable';
const DIAGNOSTICS_DETAIL_PARSER_COLD = 'ensureParserReady() runs before projection.';
const DIAGNOSTICS_DETAIL_PROJECTOR = 'createColorfulCliProseProjector is wired into projection bundles.';
const DIAGNOSTICS_DETAIL_PROCESS_TIMEOUT_PREFIX = 'process timed out after';
const DIAGNOSTICS_DETAIL_PROCESS_BUFFER_PREFIX = 'process output exceeded';
const DIAGNOSTICS_DETAIL_GRAFT_MINIMUM_PREFIX = 'Graft must be at least';
const DIAGNOSTICS_DETAIL_COLORFUL_MINIMUM_PREFIX = 'Colorful CLI must be at least';
const DIAGNOSTICS_DETAIL_MINIMUM_PARSE_PREFIX = 'could not parse required Colorful version from';
const SEMVER_CAPTURE_MAJOR = 1;
const SEMVER_CAPTURE_MINOR = 2;
const SEMVER_CAPTURE_PATCH = 3;
const SEMVER_PARTS = 3;
const SEMVER_PATTERN = /\b(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?\b/u;
const COLORFUL_PROJECTION_POSTURE = Object.freeze({
  Active: DIAGNOSTICS_VALUE_ACTIVE,
  Inactive: DIAGNOSTICS_VALUE_INACTIVE,
} as const);

type ColorfulProjectionPosture =
  typeof COLORFUL_PROJECTION_POSTURE[keyof typeof COLORFUL_PROJECTION_POSTURE];

export interface GraftAsyncProcessRunner {
  run(request: GraftProcessRunRequest): Promise<GraftProcessRunResult>;
}

export interface GraftDiagnosticsRuntime {
  readonly GRAFT_VERSION: string;
  readonly COLORFUL_CLI_MINIMUM_VERSION: string;
  isParserReady(): boolean;
}

export type LoadGraftDiagnosticsRuntime = () => Promise<GraftDiagnosticsRuntime>;

export interface GraftDiagnosticsOptions {
  readonly loadRuntime?: LoadGraftDiagnosticsRuntime;
  readonly processRunner?: GraftAsyncProcessRunner;
  readonly cwd?: string;
  readonly command?: string;
}

interface ColorfulVersionProbe {
  readonly version?: SemanticVersion;
  readonly errorDetail?: string;
}

interface RuntimeCompatibility {
  readonly graftSupportsColorful: boolean;
  readonly graftSupportDetail?: string;
  readonly colorfulMinimum?: SemanticVersion;
  readonly colorfulMinimumErrorDetail?: string;
}

interface ColorfulProjectionProbe {
  readonly posture: ColorfulProjectionPosture;
  readonly detail?: string;
}

interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

interface ProcessCaptureState {
  settled: boolean;
  stdout: string;
  stderr: string;
  readonly maxBufferBytes?: number;
}

class GraftProcessTimeoutError extends Error {}

class GraftProcessBufferError extends Error {}

export function createGraftDiagnosticsProcessRunner(): GraftAsyncProcessRunner {
  return {
    run(request: GraftProcessRunRequest): Promise<GraftProcessRunResult> {
      return runGraftProcess(request);
    },
  };
}

export function createGraftDiagnosticsPort(options: GraftDiagnosticsOptions = {}): GraftDiagnosticsPort {
  const loadRuntime = options.loadRuntime ?? defaultDiagnosticsRuntimeLoader();
  const processRunner = options.processRunner ?? createGraftDiagnosticsProcessRunner();
  const cwd = options.cwd ?? process.cwd();
  const command = options.command ?? COLORFUL_CLI_COMMAND;

  return {
    async loadDiagnostics(): Promise<GraftDiagnosticsReport> {
      const runtime = await loadRuntime();
      const colorful = await probeColorfulVersion(processRunner, cwd, command);
      const compatibility = runtimeCompatibility(runtime);
      const posture = colorfulProjectionPosture(colorful, compatibility);
      return graftDiagnosticsReport(runtime, command, colorful, compatibility, posture);
    },
    failedDiagnostics(request: FailedGraftDiagnosticsRequest): GraftDiagnosticsReport {
      return failedDiagnosticsReport(request);
    },
  };
}

function failedDiagnosticsReport(request: FailedGraftDiagnosticsRequest): GraftDiagnosticsReport {
  return {
    title: DIAGNOSTICS_TITLE,
    summary: DIAGNOSTICS_SUMMARY_FAILED,
    rows: [{
      label: DIAGNOSTICS_LABEL_PROJECTION,
      value: DIAGNOSTICS_VALUE_UNAVAILABLE,
      status: GRAFT_DIAGNOSTIC_STATUS.Error,
      detail: request.message,
    }],
  };
}

function runGraftProcess(request: GraftProcessRunRequest): Promise<GraftProcessRunResult> {
  return new Promise((resolve) => {
    const state = processCaptureState(request);
    const child = spawn(request.command, request.args, processOptions(request));
    const timeout = processTimeout(request, child, state, resolve);
    child.stdout.setEncoding(PROCESS_RUNNER_ENCODING);
    child.stderr.setEncoding(PROCESS_RUNNER_ENCODING);
    child.stdout.on('data', (chunk: string) => appendStdout(state, chunk, child, resolve));
    child.stderr.on('data', (chunk: string) => appendStderr(state, chunk, child, resolve));
    child.on('error', (error) => finishProcessCapture(state, resolve, { status: null, error }));
    child.on('close', (status) => {
      clearTimeout(timeout);
      finishProcessCapture(state, resolve, { status });
    });
    child.stdin.end(request.stdin ?? PROCESS_RUNNER_EMPTY_OUTPUT);
  });
}

function processOptions(request: GraftProcessRunRequest): SpawnOptionsWithoutStdio {
  return {
    cwd: request.cwd,
    shell: false,
    stdio: [PROCESS_STDIO_PIPE, PROCESS_STDIO_PIPE, PROCESS_STDIO_PIPE],
  };
}

function processCaptureState(request: GraftProcessRunRequest): ProcessCaptureState {
  return {
    settled: false,
    stdout: PROCESS_RUNNER_EMPTY_OUTPUT,
    stderr: PROCESS_RUNNER_EMPTY_OUTPUT,
    maxBufferBytes: request.maxBufferBytes,
  };
}

function appendStdout(
  state: ProcessCaptureState,
  chunk: string,
  child: ReturnType<typeof spawn>,
  resolve: (result: GraftProcessRunResult) => void,
): void {
  state.stdout = appendProcessOutput(state, state.stdout, chunk, child, resolve);
}

function appendStderr(
  state: ProcessCaptureState,
  chunk: string,
  child: ReturnType<typeof spawn>,
  resolve: (result: GraftProcessRunResult) => void,
): void {
  state.stderr = appendProcessOutput(state, state.stderr, chunk, child, resolve);
}

function appendProcessOutput(
  state: ProcessCaptureState,
  current: string,
  chunk: string,
  child: ReturnType<typeof spawn>,
  resolve: (result: GraftProcessRunResult) => void,
): string {
  const next = `${current}${chunk}`;
  if (state.maxBufferBytes != null && Buffer.byteLength(next, PROCESS_RUNNER_ENCODING) > state.maxBufferBytes) {
    child.kill(PROCESS_SIGNAL_KILL);
    finishProcessCapture(state, resolve, {
      status: null,
      error: new GraftProcessBufferError(`${DIAGNOSTICS_DETAIL_PROCESS_BUFFER_PREFIX} ${String(state.maxBufferBytes)} bytes`),
    });
  }
  return next;
}

function finishProcessCapture(
  state: ProcessCaptureState,
  resolve: (result: GraftProcessRunResult) => void,
  result: Pick<GraftProcessRunResult, 'status'> & Partial<Pick<GraftProcessRunResult, 'error'>>,
): void {
  if (state.settled) {
    return;
  }
  state.settled = true;
  resolve({
    status: result.status,
    stdout: state.stdout,
    stderr: state.stderr,
    ...(result.error == null ? {} : { error: result.error }),
  });
}

function processTimeout(
  request: GraftProcessRunRequest,
  child: ReturnType<typeof spawn>,
  state: ProcessCaptureState,
  resolve: (result: GraftProcessRunResult) => void,
): NodeJS.Timeout | undefined {
  if (request.timeoutMs == null) {
    return undefined;
  }
  return setTimeout(() => {
    child.kill(PROCESS_SIGNAL_KILL);
    finishProcessCapture(state, resolve, {
      status: null,
      error: new GraftProcessTimeoutError(`${DIAGNOSTICS_DETAIL_PROCESS_TIMEOUT_PREFIX} ${String(request.timeoutMs)}ms`),
    });
  }, request.timeoutMs);
}

function defaultDiagnosticsRuntimeLoader(): LoadGraftDiagnosticsRuntime {
  return async () => import('@flyingrobots/graft');
}

async function probeColorfulVersion(
  processRunner: GraftAsyncProcessRunner,
  cwd: string,
  command: string,
): Promise<ColorfulVersionProbe> {
  const result = await processRunner.run({
    command,
    args: COLORFUL_VERSION_ARGS,
    cwd,
    timeoutMs: COLORFUL_VERSION_TIMEOUT_MS,
    maxBufferBytes: COLORFUL_VERSION_MAX_BUFFER_BYTES,
  });
  const rawOutput = combinedProcessOutput(result);
  if (result.status !== PROCESS_SUCCESS_STATUS || result.error != null) {
    return { errorDetail: colorfulVersionErrorDetail(result) };
  }
  const version = parseSemanticVersion(rawOutput);
  return version == null
    ? { errorDetail: colorfulVersionParseErrorDetail(rawOutput) }
    : { version };
}

function graftDiagnosticsReport(
  runtime: GraftDiagnosticsRuntime,
  command: string,
  colorful: ColorfulVersionProbe,
  compatibility: RuntimeCompatibility,
  projection: ColorfulProjectionProbe,
): GraftDiagnosticsReport {
  return {
    title: DIAGNOSTICS_TITLE,
    summary: projectionActive(projection.posture) ? DIAGNOSTICS_SUMMARY_ACTIVE : DIAGNOSTICS_SUMMARY_INACTIVE,
    rows: [
      graftPackageRow(runtime, compatibility),
      parserRuntimeRow(runtime),
      colorfulCommandRow(command),
      colorfulMinimumRow(runtime, compatibility),
      colorfulCliRow(colorful),
      proseProjectionRow(projection),
    ],
  };
}

function colorfulProjectionPosture(
  colorful: ColorfulVersionProbe,
  compatibility: RuntimeCompatibility,
): ColorfulProjectionProbe {
  if (!compatibility.graftSupportsColorful) {
    return inactiveProjection(compatibility.graftSupportDetail);
  }
  if (compatibility.colorfulMinimum == null) {
    return inactiveProjection(compatibility.colorfulMinimumErrorDetail);
  }
  if (colorful.version == null) {
    return inactiveProjection(colorful.errorDetail);
  }
  return colorfulVersionPosture(colorful.version, compatibility.colorfulMinimum);
}

function colorfulVersionPosture(actual: SemanticVersion, minimum: SemanticVersion): ColorfulProjectionProbe {
  return semanticVersionAtLeast(actual, minimum)
    ? { posture: COLORFUL_PROJECTION_POSTURE.Active }
    : inactiveProjection(`${DIAGNOSTICS_DETAIL_COLORFUL_MINIMUM_PREFIX} ${formatSemanticVersion(minimum)}`);
}

function inactiveProjection(detail: string | undefined): ColorfulProjectionProbe {
  return {
    posture: COLORFUL_PROJECTION_POSTURE.Inactive,
    ...(detail == null ? {} : { detail }),
  };
}

function runtimeCompatibility(runtime: GraftDiagnosticsRuntime): RuntimeCompatibility {
  const graftVersion = parseSemanticVersion(runtime.GRAFT_VERSION);
  const minimumGraftVersion = parseSemanticVersion(GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION);
  const colorfulMinimum = parseSemanticVersion(runtime.COLORFUL_CLI_MINIMUM_VERSION);
  const graftSupportsColorful = graftVersion != null &&
    minimumGraftVersion != null &&
    semanticVersionAtLeast(graftVersion, minimumGraftVersion);
  return {
    graftSupportsColorful,
    ...(graftSupportsColorful ? {} : { graftSupportDetail: graftSupportDetail() }),
    ...(colorfulMinimum == null
      ? { colorfulMinimumErrorDetail: colorfulMinimumParseDetail(runtime.COLORFUL_CLI_MINIMUM_VERSION) }
      : { colorfulMinimum }),
  };
}

function graftPackageRow(runtime: GraftDiagnosticsRuntime, compatibility: RuntimeCompatibility): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_GRAFT,
    value: runtime.GRAFT_VERSION,
    status: compatibility.graftSupportsColorful ? GRAFT_DIAGNOSTIC_STATUS.Ok : GRAFT_DIAGNOSTIC_STATUS.Error,
    ...(compatibility.graftSupportDetail == null ? {} : { detail: compatibility.graftSupportDetail }),
  };
}

function parserRuntimeRow(runtime: GraftDiagnosticsRuntime): GraftDiagnosticRow {
  const ready = runtime.isParserReady();
  return {
    label: DIAGNOSTICS_LABEL_PARSER,
    value: ready ? DIAGNOSTICS_VALUE_READY : DIAGNOSTICS_VALUE_COLD,
    status: ready ? GRAFT_DIAGNOSTIC_STATUS.Ok : GRAFT_DIAGNOSTIC_STATUS.Warning,
    ...(ready ? {} : { detail: DIAGNOSTICS_DETAIL_PARSER_COLD }),
  };
}

function colorfulCommandRow(command: string): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_COMMAND,
    value: command,
    status: GRAFT_DIAGNOSTIC_STATUS.Ok,
  };
}

function colorfulMinimumRow(runtime: GraftDiagnosticsRuntime, compatibility: RuntimeCompatibility): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_MINIMUM,
    value: runtime.COLORFUL_CLI_MINIMUM_VERSION,
    status: compatibility.colorfulMinimum == null ? GRAFT_DIAGNOSTIC_STATUS.Error : GRAFT_DIAGNOSTIC_STATUS.Ok,
    ...(compatibility.colorfulMinimumErrorDetail == null ? {} : { detail: compatibility.colorfulMinimumErrorDetail }),
  };
}

function colorfulCliRow(colorful: ColorfulVersionProbe): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_CLI,
    value: colorful.version == null ? DIAGNOSTICS_VALUE_UNAVAILABLE : formatSemanticVersion(colorful.version),
    status: colorful.version == null ? GRAFT_DIAGNOSTIC_STATUS.Error : GRAFT_DIAGNOSTIC_STATUS.Ok,
    ...(colorful.errorDetail == null ? {} : { detail: colorful.errorDetail }),
  };
}

function proseProjectionRow(projection: ColorfulProjectionProbe): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_PROJECTION,
    value: projection.posture,
    status: projectionActive(projection.posture) ? GRAFT_DIAGNOSTIC_STATUS.Ok : GRAFT_DIAGNOSTIC_STATUS.Warning,
    detail: projection.detail ?? DIAGNOSTICS_DETAIL_PROJECTOR,
  };
}

function projectionActive(posture: ColorfulProjectionPosture): boolean {
  return posture === COLORFUL_PROJECTION_POSTURE.Active;
}

function combinedProcessOutput(result: GraftProcessRunResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

function colorfulVersionErrorDetail(result: GraftProcessRunResult): string {
  if (result.error != null) {
    return result.error.message;
  }
  if (result.stderr.trim().length > 0) {
    return result.stderr.trim();
  }
  return `colorful version probe exited with status ${String(result.status)}`;
}

function colorfulVersionParseErrorDetail(rawOutput: string): string {
  return rawOutput.length === 0
    ? 'colorful version probe returned no output'
    : `could not parse colorful version from: ${rawOutput}`;
}

function colorfulMinimumParseDetail(value: string): string {
  return `${DIAGNOSTICS_DETAIL_MINIMUM_PARSE_PREFIX}: ${value}`;
}

function graftSupportDetail(): string {
  return `${DIAGNOSTICS_DETAIL_GRAFT_MINIMUM_PREFIX} ${GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION} for Colorful prose IDs`;
}

function parseSemanticVersion(value: string): SemanticVersion | undefined {
  const match = SEMVER_PATTERN.exec(value);
  if (match == null || match.length < SEMVER_PARTS + 1) {
    return undefined;
  }
  return semanticVersionFromMatch(match);
}

function semanticVersionFromMatch(match: RegExpExecArray): SemanticVersion | undefined {
  const major = Number(match[SEMVER_CAPTURE_MAJOR]);
  const minor = Number(match[SEMVER_CAPTURE_MINOR]);
  const patch = Number(match[SEMVER_CAPTURE_PATCH]);
  return Number.isFinite(major) && Number.isFinite(minor) && Number.isFinite(patch)
    ? { major, minor, patch }
    : undefined;
}

function semanticVersionAtLeast(actual: SemanticVersion, minimum: SemanticVersion): boolean {
  if (actual.major !== minimum.major) {
    return actual.major > minimum.major;
  }
  if (actual.minor !== minimum.minor) {
    return actual.minor > minimum.minor;
  }
  return actual.patch >= minimum.patch;
}

function formatSemanticVersion(version: SemanticVersion): string {
  return `${String(version.major)}.${String(version.minor)}.${String(version.patch)}`;
}
