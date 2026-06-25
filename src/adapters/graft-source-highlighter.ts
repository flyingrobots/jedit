import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import {
  SOURCE_HIGHLIGHT_ROLE,
  type SourceHighlightReading,
  type SourceHighlighter,
  type SourceHighlightInput,
  type SourceHighlightRole,
  type SourceHighlightSpan,
  type SourceRange,
} from '../ports/source-highlighter.js';
import {
  GRAFT_DIAGNOSTIC_STATUS,
  type FailedGraftDiagnosticsRequest,
  type GraftDiagnosticRow,
  type GraftDiagnosticsPort,
  type GraftDiagnosticsReport,
} from '../ports/graft-diagnostics.js';

const EDITOR_HEAD_BASIS_KIND = 'editor_head';
const COLORFUL_CLI_COMMAND = 'colorful';
const PROCESS_RUNNER_ENCODING = 'utf8';
const PROCESS_RUNNER_EMPTY_OUTPUT = '';
const PROCESS_SUCCESS_STATUS = 0;
const COLORFUL_VERSION_ARGS: readonly string[] = ['--version'];
const COLORFUL_VERSION_TIMEOUT_MS = 5000;
const BYTES_PER_KIBIBYTE = 1024;
const COLORFUL_VERSION_MAX_BUFFER_BYTES = 64 * BYTES_PER_KIBIBYTE;
const VIEWPORT_START_COLUMN = 0;
const VIEWPORT_END_COLUMN = 0;
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

const GRAFT_CLASS_COMMENT = 'comment';
const GRAFT_CLASS_FUNCTION = 'function';
const GRAFT_CLASS_KEYWORD = 'keyword';
const GRAFT_CLASS_NUMBER = 'number';
const GRAFT_CLASS_OPERATOR = 'operator';
const GRAFT_CLASS_PROPERTY = 'property';
const GRAFT_CLASS_PUNCTUATION = 'punctuation';
const GRAFT_CLASS_STRING = 'string';
const GRAFT_CLASS_TYPE = 'type';
const GRAFT_CLASS_VARIABLE = 'variable';

type GraftSyntaxClass =
  | typeof GRAFT_CLASS_COMMENT
  | typeof GRAFT_CLASS_FUNCTION
  | typeof GRAFT_CLASS_KEYWORD
  | typeof GRAFT_CLASS_NUMBER
  | typeof GRAFT_CLASS_OPERATOR
  | typeof GRAFT_CLASS_PROPERTY
  | typeof GRAFT_CLASS_PUNCTUATION
  | typeof GRAFT_CLASS_STRING
  | typeof GRAFT_CLASS_TYPE
  | typeof GRAFT_CLASS_VARIABLE;

interface GraftPoint {
  readonly row: number;
  readonly column: number;
}

interface GraftRange {
  readonly start: GraftPoint;
  readonly end: GraftPoint;
}

interface GraftSyntaxSpan {
  readonly className: string;
  readonly range: GraftRange;
}

interface GraftProjectionBundle {
  readonly syntax: {
    readonly partial?: boolean;
    readonly spans: readonly GraftSyntaxSpan[];
    readonly reason?: string;
  };
}

interface GraftProjectionOptions {
  readonly basis: {
    readonly kind: typeof EDITOR_HEAD_BASIS_KIND;
    readonly headId: string;
    readonly tick: number;
  };
  readonly viewport: {
    readonly start: GraftPoint;
    readonly end: GraftPoint;
  };
}

export interface GraftProcessRunRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly stdin?: string;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
}

export interface GraftProcessRunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
}

export interface GraftProcessRunner {
  run(request: GraftProcessRunRequest): GraftProcessRunResult;
}

export interface GraftSourceHighlighterRuntime {
  ensureParserReady(): Promise<void>;
  createProjectionBundle(path: string, content: string, options: GraftProjectionOptions): GraftProjectionBundle;
}

export type LoadGraftSourceHighlighterRuntime = () => Promise<GraftSourceHighlighterRuntime>;

export interface GraftDiagnosticsRuntime {
  readonly GRAFT_VERSION: string;
  readonly COLORFUL_CLI_MINIMUM_VERSION: string;
  isParserReady(): boolean;
}

export type LoadGraftDiagnosticsRuntime = () => Promise<GraftDiagnosticsRuntime>;

export interface GraftSourceHighlighterOptions {
  readonly loadRuntime?: LoadGraftSourceHighlighterRuntime;
}

export interface GraftDiagnosticsOptions {
  readonly loadRuntime?: LoadGraftDiagnosticsRuntime;
  readonly processRunner?: GraftProcessRunner;
  readonly cwd?: string;
  readonly command?: string;
}

interface GraftRoleEntry {
  readonly className: GraftSyntaxClass;
  readonly role: SourceHighlightRole;
}

const GRAFT_ROLE_ENTRIES: readonly GraftRoleEntry[] = [
  { className: GRAFT_CLASS_COMMENT, role: SOURCE_HIGHLIGHT_ROLE.Comment },
  { className: GRAFT_CLASS_FUNCTION, role: SOURCE_HIGHLIGHT_ROLE.Function },
  { className: GRAFT_CLASS_KEYWORD, role: SOURCE_HIGHLIGHT_ROLE.Keyword },
  { className: GRAFT_CLASS_NUMBER, role: SOURCE_HIGHLIGHT_ROLE.Number },
  { className: GRAFT_CLASS_OPERATOR, role: SOURCE_HIGHLIGHT_ROLE.Operator },
  { className: GRAFT_CLASS_PROPERTY, role: SOURCE_HIGHLIGHT_ROLE.Property },
  { className: GRAFT_CLASS_PUNCTUATION, role: SOURCE_HIGHLIGHT_ROLE.Punctuation },
  { className: GRAFT_CLASS_STRING, role: SOURCE_HIGHLIGHT_ROLE.String },
  { className: GRAFT_CLASS_TYPE, role: SOURCE_HIGHLIGHT_ROLE.Type },
  { className: GRAFT_CLASS_VARIABLE, role: SOURCE_HIGHLIGHT_ROLE.Variable },
];

let cachedRuntime: GraftSourceHighlighterRuntime | undefined;

export function createGraftSourceHighlighterProcessRunner(): GraftProcessRunner {
  return {
    run(request: GraftProcessRunRequest): GraftProcessRunResult {
      const options: SpawnSyncOptionsWithStringEncoding = {
        cwd: request.cwd,
        encoding: PROCESS_RUNNER_ENCODING,
        shell: false,
      };
      if (request.stdin != null) {
        options.input = request.stdin;
      }
      if (request.timeoutMs != null) {
        options.timeout = request.timeoutMs;
      }
      if (request.maxBufferBytes != null) {
        options.maxBuffer = request.maxBufferBytes;
      }

      const result = spawnSync(request.command, request.args, options);
      return {
        status: result.status,
        stdout: result.stdout ?? PROCESS_RUNNER_EMPTY_OUTPUT,
        stderr: result.stderr ?? PROCESS_RUNNER_EMPTY_OUTPUT,
        ...(result.error == null ? {} : { error: result.error }),
      };
    },
  };
}

export function createGraftSourceHighlighter(options: GraftSourceHighlighterOptions = {}): SourceHighlighter {
  const loadRuntime = options.loadRuntime ?? defaultRuntimeLoader();

  return {
    async highlight(input: SourceHighlightInput): Promise<SourceHighlightReading> {
      const runtime = await loadRuntime();
      await runtime.ensureParserReady();
      const bundle = runtime.createProjectionBundle(input.path, input.text, {
        basis: {
          kind: EDITOR_HEAD_BASIS_KIND,
          headId: input.headId,
          tick: input.tick,
        },
        viewport: {
          start: { row: input.startLine, column: VIEWPORT_START_COLUMN },
          end: { row: input.startLine + input.lineCount, column: VIEWPORT_END_COLUMN },
        },
      });

      return {
        path: input.path,
        partial: bundle.syntax.partial === true,
        spans: graftSyntaxSpansToSourceHighlights(bundle.syntax.spans),
        ...(bundle.syntax.reason == null ? {} : { notice: bundle.syntax.reason }),
      };
    },
  };
}

export function createGraftDiagnosticsPort(options: GraftDiagnosticsOptions = {}): GraftDiagnosticsPort {
  const loadRuntime = options.loadRuntime ?? defaultDiagnosticsRuntimeLoader();
  const processRunner = options.processRunner ?? createGraftSourceHighlighterProcessRunner();
  const cwd = options.cwd ?? process.cwd();
  const command = options.command ?? COLORFUL_CLI_COMMAND;

  return {
    async loadDiagnostics(): Promise<GraftDiagnosticsReport> {
      const runtime = await loadRuntime();
      const colorful = probeColorfulVersion(processRunner, cwd, command);
      const posture = colorfulProjectionPosture(colorful, runtime.COLORFUL_CLI_MINIMUM_VERSION);
      return graftDiagnosticsReport(runtime, command, colorful, posture);
    },
    failedDiagnostics(request: FailedGraftDiagnosticsRequest): GraftDiagnosticsReport {
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
    },
  };
}

export function graftSyntaxSpansToSourceHighlights(spans: readonly GraftSyntaxSpan[]): readonly SourceHighlightSpan[] {
  return spans.flatMap((span) => {
    const role = sourceRoleForGraftClass(span.className);
    if (role == null) {
      return [];
    }
    return [{
      role,
      range: sourceRangeFromGraftRange(span.range),
    }];
  });
}

function sourceRoleForGraftClass(className: string): SourceHighlightRole | undefined {
  for (const entry of GRAFT_ROLE_ENTRIES) {
    if (entry.className === className) {
      return entry.role;
    }
  }
  return undefined;
}

function sourceRangeFromGraftRange(range: GraftRange): SourceRange {
  return {
    start: { row: range.start.row, column: range.start.column },
    end: { row: range.end.row, column: range.end.column },
  };
}

function defaultRuntimeLoader(): LoadGraftSourceHighlighterRuntime {
  return async () => {
    if (cachedRuntime != null) {
      return cachedRuntime;
    }

    const runtime = await import('@flyingrobots/graft');
    const processRunner = createGraftSourceHighlighterProcessRunner();
    const proseProjector = runtime.createColorfulCliProseProjector({
      processRunner,
      cwd: process.cwd(),
      command: COLORFUL_CLI_COMMAND,
    });
    cachedRuntime = {
      ensureParserReady: runtime.ensureParserReady,
      createProjectionBundle: (path, content, options) => runtime.createProjectionBundle(path, content, {
        ...options,
        proseProjector,
      }),
    };
    return cachedRuntime;
  };
}

function defaultDiagnosticsRuntimeLoader(): LoadGraftDiagnosticsRuntime {
  return async () => import('@flyingrobots/graft');
}

interface ColorfulVersionProbe {
  readonly version?: SemanticVersion;
  readonly errorDetail?: string;
}

interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

function probeColorfulVersion(
  processRunner: GraftProcessRunner,
  cwd: string,
  command: string,
): ColorfulVersionProbe {
  const result = processRunner.run({
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
  posture: ColorfulProjectionPosture,
): GraftDiagnosticsReport {
  return {
    title: DIAGNOSTICS_TITLE,
    summary: projectionActive(posture) ? DIAGNOSTICS_SUMMARY_ACTIVE : DIAGNOSTICS_SUMMARY_INACTIVE,
    rows: [
      graftPackageRow(runtime),
      parserRuntimeRow(runtime),
      colorfulCommandRow(command),
      colorfulMinimumRow(runtime),
      colorfulCliRow(colorful, posture),
      proseProjectionRow(posture),
    ],
  };
}

function colorfulProjectionPosture(
  colorful: ColorfulVersionProbe,
  minimumVersion: string,
): ColorfulProjectionPosture {
  return colorful.version != null &&
    semanticVersionAtLeast(colorful.version, parseRequiredSemanticVersion(minimumVersion))
    ? COLORFUL_PROJECTION_POSTURE.Active
    : COLORFUL_PROJECTION_POSTURE.Inactive;
}

function graftPackageRow(runtime: GraftDiagnosticsRuntime): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_GRAFT,
    value: runtime.GRAFT_VERSION,
    status: GRAFT_DIAGNOSTIC_STATUS.Ok,
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

function colorfulMinimumRow(runtime: GraftDiagnosticsRuntime): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_MINIMUM,
    value: runtime.COLORFUL_CLI_MINIMUM_VERSION,
    status: GRAFT_DIAGNOSTIC_STATUS.Ok,
  };
}

function colorfulCliRow(colorful: ColorfulVersionProbe, posture: ColorfulProjectionPosture): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_CLI,
    value: colorful.version == null ? DIAGNOSTICS_VALUE_UNAVAILABLE : formatSemanticVersion(colorful.version),
    status: projectionActive(posture) ? GRAFT_DIAGNOSTIC_STATUS.Ok : GRAFT_DIAGNOSTIC_STATUS.Error,
    ...(colorful.errorDetail == null ? {} : { detail: colorful.errorDetail }),
  };
}

function proseProjectionRow(posture: ColorfulProjectionPosture): GraftDiagnosticRow {
  return {
    label: DIAGNOSTICS_LABEL_PROJECTION,
    value: posture,
    status: projectionActive(posture) ? GRAFT_DIAGNOSTIC_STATUS.Ok : GRAFT_DIAGNOSTIC_STATUS.Warning,
    ...(projectionActive(posture) ? { detail: DIAGNOSTICS_DETAIL_PROJECTOR } : {}),
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

function parseRequiredSemanticVersion(value: string): SemanticVersion {
  return parseSemanticVersion(value) ?? { major: 0, minor: 0, patch: 0 };
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
