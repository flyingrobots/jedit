export type VimGrammarTokenKind =
  | 'commandLineInvocation'
  | 'commandLineText'
  | 'count'
  | 'macroControl'
  | 'modeSwitch'
  | 'motion'
  | 'operator'
  | 'prefix'
  | 'register'
  | 'textObject'
  | 'unknown'
  | 'visualPrefix';

export const VimGrammarTokenKinds: Record<string, VimGrammarTokenKind> = Object.freeze({
  CommandLineInvocation: 'commandLineInvocation',
  CommandLineText: 'commandLineText',
  Count: 'count',
  MacroControl: 'macroControl',
  ModeSwitch: 'modeSwitch',
  Motion: 'motion',
  Operator: 'operator',
  Prefix: 'prefix',
  Register: 'register',
  TextObject: 'textObject',
  Unknown: 'unknown',
  VisualPrefix: 'visualPrefix',
});

export type VimOperatorName =
  | 'change'
  | 'changeToLineEnd'
  | 'delete'
  | 'deleteChar'
  | 'deleteToLineEnd'
  | 'filter'
  | 'format'
  | 'indent'
  | 'joinNoSpace'
  | 'lowercase'
  | 'outdent'
  | 'putAfter'
  | 'putBefore'
  | 'swapCase'
  | 'uppercase'
  | 'yank'
  | 'yankLine';

export type VimMotionName =
  | 'WORDBackward'
  | 'WORDEnd'
  | 'WORDForward'
  | 'charLeft'
  | 'charRight'
  | 'fileBottom'
  | 'fileTop'
  | 'firstNonWhitespace'
  | 'lineCurrent'
  | 'lineDown'
  | 'lineEnd'
  | 'lineStart'
  | 'lineUp'
  | 'matchingPair'
  | 'nextSearch'
  | 'paragraphBackward'
  | 'paragraphForward'
  | 'previousSearch'
  | 'sectionBackward'
  | 'sectionForward'
  | 'symbolBackward'
  | 'symbolForward'
  | 'wordBackward'
  | 'wordEnd'
  | 'wordForward';

export type VimTextObjectScope = 'around' | 'inner';
export type VimTextObjectTarget =
  | 'WORD'
  | 'angle'
  | 'backtick'
  | 'brace'
  | 'bracket'
  | 'doubleQuote'
  | 'paragraph'
  | 'paren'
  | 'sentence'
  | 'singleQuote'
  | 'word';

export type VimModeSwitchName =
  | 'insertAfter'
  | 'insertBefore'
  | 'insertFirstNonWhitespace'
  | 'insertLineEnd'
  | 'openLineAbove'
  | 'openLineBelow'
  | 'replace';

export type VimVisualModeName = 'block' | 'char' | 'line';
export type VimMacroControlName = 'record' | 'replay' | 'replayLast';

interface VimTokenBase {
  readonly at: number;
  readonly kind: VimGrammarTokenKind;
  readonly raw: readonly string[];
}

export interface VimCountToken extends VimTokenBase {
  readonly kind: 'count';
  readonly value: number;
}

export interface VimRegisterToken extends VimTokenBase {
  readonly kind: 'register';
  readonly register: string;
}

export interface VimOperatorToken extends VimTokenBase {
  readonly kind: 'operator';
  readonly operator: VimOperatorName;
}

export interface VimMotionToken extends VimTokenBase {
  readonly kind: 'motion';
  readonly motion: VimMotionName;
}

export interface VimTextObjectToken extends VimTokenBase {
  readonly kind: 'textObject';
  readonly scope: VimTextObjectScope;
  readonly target: VimTextObjectTarget;
}

export interface VimModeSwitchToken extends VimTokenBase {
  readonly kind: 'modeSwitch';
  readonly modeSwitch: VimModeSwitchName;
}

export interface VimVisualPrefixToken extends VimTokenBase {
  readonly kind: 'visualPrefix';
  readonly visualMode: VimVisualModeName;
}

export interface VimCommandLineInvocationToken extends VimTokenBase {
  readonly kind: 'commandLineInvocation';
}

export interface VimCommandLineTextToken extends VimTokenBase {
  readonly kind: 'commandLineText';
  readonly text: string;
}

export interface VimMacroControlToken extends VimTokenBase {
  readonly control: VimMacroControlName;
  readonly kind: 'macroControl';
  readonly register?: string;
}

export interface VimPrefixToken extends VimTokenBase {
  readonly kind: 'prefix';
  readonly prefix: string;
}

export interface VimUnknownToken extends VimTokenBase {
  readonly kind: 'unknown';
}

export type VimGrammarToken =
  | VimCommandLineInvocationToken
  | VimCommandLineTextToken
  | VimCountToken
  | VimMacroControlToken
  | VimModeSwitchToken
  | VimMotionToken
  | VimOperatorToken
  | VimPrefixToken
  | VimRegisterToken
  | VimTextObjectToken
  | VimUnknownToken
  | VimVisualPrefixToken;

export const REGISTER_PREFIX = '"';
export const COMMAND_LINE_PREFIX = ':';
export const COMMAND_LINE_ACCEPT_KEY = 'enter';
export const MACRO_RECORD_KEY = 'q';
export const MACRO_REPLAY_KEY = '@';
export const CTRL_V_KEY = 'ctrl-v';
export const ZERO_KEY = '0';
export const COUNT_MIN = '1';
export const COUNT_MAX = '9';
export const G_PREFIX = 'g';
export const SECTION_BACKWARD_PREFIX = '[';
export const SECTION_FORWARD_PREFIX = ']';
export const TEXT_OBJECT_AROUND_PREFIX = 'a';
export const TEXT_OBJECT_INNER_PREFIX = 'i';
export const TEXT_OBJECT_AROUND_SCOPE: VimTextObjectScope = 'around';
export const TEXT_OBJECT_INNER_SCOPE: VimTextObjectScope = 'inner';

export const REGISTER_NAMES = new Set('"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-+*='.split(''));
export const LINEWISE_OPERATOR_KEYS = new Set(['c', 'd', 'y']);
export const INCOMPLETE_PREFIX_KEYS = new Set([G_PREFIX, SECTION_BACKWARD_PREFIX, SECTION_FORWARD_PREFIX]);

export const SINGLE_OPERATORS: ReadonlyMap<string, VimOperatorName> = new Map([
  ['!', 'filter'],
  ['<', 'outdent'],
  ['=', 'format'],
  ['>', 'indent'],
  ['C', 'changeToLineEnd'],
  ['D', 'deleteToLineEnd'],
  ['P', 'putBefore'],
  ['Y', 'yankLine'],
  ['c', 'change'],
  ['d', 'delete'],
  ['p', 'putAfter'],
  ['x', 'deleteChar'],
  ['y', 'yank'],
]);

export const G_OPERATORS: ReadonlyMap<string, VimOperatorName> = new Map([
  ['gJ', 'joinNoSpace'],
  ['gU', 'uppercase'],
  ['gq', 'format'],
  ['gu', 'lowercase'],
  ['g~', 'swapCase'],
]);

export const SINGLE_MOTIONS: ReadonlyMap<string, VimMotionName> = new Map([
  ['$', 'lineEnd'],
  ['%', 'matchingPair'],
  ['0', 'lineStart'],
  ['B', 'WORDBackward'],
  ['E', 'WORDEnd'],
  ['G', 'fileBottom'],
  ['N', 'previousSearch'],
  ['W', 'WORDForward'],
  ['^', 'firstNonWhitespace'],
  ['b', 'wordBackward'],
  ['e', 'wordEnd'],
  ['h', 'charLeft'],
  ['j', 'lineDown'],
  ['k', 'lineUp'],
  ['l', 'charRight'],
  ['n', 'nextSearch'],
  ['w', 'wordForward'],
  ['{', 'paragraphBackward'],
  ['}', 'paragraphForward'],
]);

export const DOUBLE_MOTIONS: ReadonlyMap<string, VimMotionName> = new Map([
  ['[[', 'sectionBackward'],
  [']]', 'sectionForward'],
  ['g#', 'symbolBackward'],
  ['g*', 'symbolForward'],
  ['gg', 'fileTop'],
]);

export const TEXT_OBJECTS: ReadonlyMap<string, VimTextObjectTarget> = new Map([
  ['"', 'doubleQuote'],
  ["'", 'singleQuote'],
  ['(', 'paren'],
  [')', 'paren'],
  ['<', 'angle'],
  ['>', 'angle'],
  ['B', 'brace'],
  ['W', 'WORD'],
  ['[', 'bracket'],
  [']', 'bracket'],
  ['`', 'backtick'],
  ['b', 'paren'],
  ['p', 'paragraph'],
  ['s', 'sentence'],
  ['w', 'word'],
  ['{', 'brace'],
  ['}', 'brace'],
]);

export const MODE_SWITCHES: ReadonlyMap<string, VimModeSwitchName> = new Map([
  ['A', 'insertLineEnd'],
  ['I', 'insertFirstNonWhitespace'],
  ['O', 'openLineAbove'],
  ['R', 'replace'],
  ['a', 'insertAfter'],
  ['i', 'insertBefore'],
  ['o', 'openLineBelow'],
]);

export const VISUAL_PREFIXES: ReadonlyMap<string, VimVisualModeName> = new Map([
  ['V', 'line'],
  ['v', 'char'],
  [CTRL_V_KEY, 'block'],
]);
