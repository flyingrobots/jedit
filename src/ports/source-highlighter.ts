import type { HotTextWindowProjection } from './hot-text-runtime.js';

const COMMENT_ROLE_DESCRIPTION = 'jedit.source-highlight.comment';
const FUNCTION_ROLE_DESCRIPTION = 'jedit.source-highlight.function';
const KEYWORD_ROLE_DESCRIPTION = 'jedit.source-highlight.keyword';
const NUMBER_ROLE_DESCRIPTION = 'jedit.source-highlight.number';
const OPERATOR_ROLE_DESCRIPTION = 'jedit.source-highlight.operator';
const PROPERTY_ROLE_DESCRIPTION = 'jedit.source-highlight.property';
const PUNCTUATION_ROLE_DESCRIPTION = 'jedit.source-highlight.punctuation';
const STRING_ROLE_DESCRIPTION = 'jedit.source-highlight.string';
const TYPE_ROLE_DESCRIPTION = 'jedit.source-highlight.type';
const VARIABLE_ROLE_DESCRIPTION = 'jedit.source-highlight.variable';

export const SOURCE_HIGHLIGHT_ROLE = {
  Comment: Symbol(COMMENT_ROLE_DESCRIPTION),
  Function: Symbol(FUNCTION_ROLE_DESCRIPTION),
  Keyword: Symbol(KEYWORD_ROLE_DESCRIPTION),
  Number: Symbol(NUMBER_ROLE_DESCRIPTION),
  Operator: Symbol(OPERATOR_ROLE_DESCRIPTION),
  Property: Symbol(PROPERTY_ROLE_DESCRIPTION),
  Punctuation: Symbol(PUNCTUATION_ROLE_DESCRIPTION),
  String: Symbol(STRING_ROLE_DESCRIPTION),
  Type: Symbol(TYPE_ROLE_DESCRIPTION),
  Variable: Symbol(VARIABLE_ROLE_DESCRIPTION),
} as const;

export type SourceHighlightRole = typeof SOURCE_HIGHLIGHT_ROLE[keyof typeof SOURCE_HIGHLIGHT_ROLE];

export interface SourcePoint {
  readonly row: number;
  readonly column: number;
}

export interface SourceRange {
  readonly start: SourcePoint;
  readonly end: SourcePoint;
}

export interface SourceHighlightSpan {
  readonly role: SourceHighlightRole;
  readonly range: SourceRange;
}

export interface SourceHighlightInput {
  readonly path: string;
  readonly text: string;
  readonly startLine: number;
  readonly lineCount: number;
  readonly headId: string;
  readonly tick: number;
  readonly textStartLine?: number;
  readonly projection?: HotTextWindowProjection;
}

export interface SourceHighlightReading {
  readonly path: string;
  readonly partial: boolean;
  readonly spans: readonly SourceHighlightSpan[];
  readonly projection?: HotTextWindowProjection;
  readonly notice?: string;
  readonly error?: string;
}

export interface SourceHighlighter {
  highlight(input: SourceHighlightInput): Promise<SourceHighlightReading>;
}
