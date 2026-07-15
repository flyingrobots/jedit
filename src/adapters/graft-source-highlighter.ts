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
export {
  createGraftDiagnosticsPort,
  createGraftDiagnosticsProcessRunner,
} from './graft-diagnostics-adapter.js';
export type {
  GraftAsyncProcessRunner,
  GraftDiagnosticsOptions,
  GraftDiagnosticsRuntime,
  LoadGraftDiagnosticsRuntime,
} from './graft-diagnostics-adapter.js';

const EDITOR_HEAD_BASIS_KIND = 'editor_head';
const COLORFUL_CLI_COMMAND = 'colorful';
const PROCESS_RUNNER_ENCODING = 'utf8';
const PROCESS_RUNNER_EMPTY_OUTPUT = '';
const VIEWPORT_START_COLUMN = 0;
const FIRST_PROJECTED_LINE = 0;
const VIEWPORT_END_COLUMN = 0;
const DIAGNOSTICS_NOTICE_PROJECTION_FAILED_PREFIX = 'Graft projection failed';

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

export interface GraftSourceHighlighterOptions {
  readonly loadRuntime?: LoadGraftSourceHighlighterRuntime;
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
      const bundle = readProjectionBundle(runtime, input);

      return {
        path: input.path,
        partial: bundle.partial,
        spans: graftSyntaxSpansToSourceHighlights(bundle.spans, input.textStartLine),
        projection: input.projection,
        ...(bundle.reason == null ? {} : { notice: bundle.reason }),
      };
    },
  };
}

function readProjectionBundle(
  runtime: GraftSourceHighlighterRuntime,
  input: SourceHighlightInput,
): {
  readonly partial: boolean;
  readonly spans: readonly GraftSyntaxSpan[];
  readonly reason?: string;
} {
  try {
    const textStartLine = input.textStartLine ?? FIRST_PROJECTED_LINE;
    const bundle = runtime.createProjectionBundle(input.path, input.text, {
      basis: {
        kind: EDITOR_HEAD_BASIS_KIND,
        headId: input.headId,
        tick: input.tick,
      },
      viewport: {
        start: { row: input.startLine - textStartLine, column: VIEWPORT_START_COLUMN },
        end: { row: input.startLine - textStartLine + input.lineCount, column: VIEWPORT_END_COLUMN },
      },
    });
    return {
      partial: bundle.syntax.partial === true,
      spans: bundle.syntax.spans,
      ...(bundle.syntax.reason == null ? {} : { reason: bundle.syntax.reason }),
    };
  } catch (cause) {
    return {
      partial: true,
      spans: [],
      reason: cause instanceof Error
        ? `${DIAGNOSTICS_NOTICE_PROJECTION_FAILED_PREFIX}: ${cause.message}`
        : `${DIAGNOSTICS_NOTICE_PROJECTION_FAILED_PREFIX}: ${String(cause)}`,
    };
  }
}

export function graftSyntaxSpansToSourceHighlights(
  spans: readonly GraftSyntaxSpan[],
  textStartLine: number = FIRST_PROJECTED_LINE,
): readonly SourceHighlightSpan[] {
  return spans.flatMap((span) => {
    const role = sourceRoleForGraftClass(span.className);
    if (role == null) {
      return [];
    }
    return [{
      role,
      range: sourceRangeFromGraftRange(span.range, textStartLine),
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

function sourceRangeFromGraftRange(range: GraftRange, textStartLine: number): SourceRange {
  return {
    start: { row: range.start.row + textStartLine, column: range.start.column },
    end: { row: range.end.row + textStartLine, column: range.end.column },
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
