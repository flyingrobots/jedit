import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SOURCE_HIGHLIGHT_ROLE,
  type SourceHighlightReading,
  type SourceHighlighter,
  type SourceHighlightInput,
  type SourceHighlightRole,
  type SourceHighlightSpan,
  type SourceRange,
} from '../ports/source-highlighter.js';

const GRAFT_ROOT_ENV = 'JEDIT_GRAFT_ROOT';
const DIST_DIRECTORY_NAME = 'dist';
const INDEX_MODULE_NAME = 'index.js';
const DEFAULT_GRAFT_REPO_DIRECTORY = 'graft';
const DEFAULT_GIT_DIRECTORY = 'git';
const EDITOR_HEAD_BASIS_KIND = 'editor_head';
const VIEWPORT_START_COLUMN = 0;
const VIEWPORT_END_COLUMN = 0;

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

export interface GraftSourceHighlighterRuntime {
  ensureParserReady(): Promise<void>;
  createProjectionBundle(path: string, content: string, options: GraftProjectionOptions): GraftProjectionBundle;
}

export type LoadGraftSourceHighlighterRuntime = () => Promise<GraftSourceHighlighterRuntime>;

export interface GraftSourceHighlighterOptions {
  readonly graftRoot?: string;
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

let cachedRuntimePath: string | undefined;
let cachedRuntime: GraftSourceHighlighterRuntime | undefined;

export function createGraftSourceHighlighter(options: GraftSourceHighlighterOptions = {}): SourceHighlighter {
  const loadRuntime = options.loadRuntime ?? defaultRuntimeLoader(options.graftRoot ?? defaultGraftRoot());

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

function defaultRuntimeLoader(graftRoot: string): LoadGraftSourceHighlighterRuntime {
  return async () => {
    const runtimePath = join(graftRoot, DIST_DIRECTORY_NAME, INDEX_MODULE_NAME);
    if (cachedRuntime != null && cachedRuntimePath === runtimePath) {
      return cachedRuntime;
    }
    if (!existsSync(runtimePath)) {
      throw new Error(`Graft runtime not found at ${runtimePath}`);
    }
    cachedRuntime = await import(pathToFileURL(runtimePath).href) as GraftSourceHighlighterRuntime;
    cachedRuntimePath = runtimePath;
    return cachedRuntime;
  };
}

function defaultGraftRoot(): string {
  return process.env[GRAFT_ROOT_ENV] ?? join(homedir(), DEFAULT_GIT_DIRECTORY, DEFAULT_GRAFT_REPO_DIRECTORY);
}
