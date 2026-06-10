import type {
  VimCommandLineTextToken,
  VimCountToken,
  VimGrammarToken,
  VimMacroControlToken,
  VimMarkToken,
  VimModeSwitchToken,
  VimMotionToken,
  VimOperatorToken,
  VimRegisterToken,
  VimTextObjectToken,
  VimVisualPrefixToken,
} from './vim-grammar.js';

const TOKEN_COMMAND_LINE_INVOCATION = 'commandLineInvocation';
const TOKEN_COMMAND_LINE_TEXT = 'commandLineText';
const TOKEN_COUNT = 'count';
const TOKEN_MACRO_CONTROL = 'macroControl';
const TOKEN_MARK = 'mark';
const TOKEN_MODE_SWITCH = 'modeSwitch';
const TOKEN_MOTION = 'motion';
const TOKEN_OPERATOR = 'operator';
const TOKEN_PREFIX = 'prefix';
const TOKEN_REGISTER = 'register';
const TOKEN_TEXT_OBJECT = 'textObject';
const TOKEN_UNKNOWN = 'unknown';
const TOKEN_VISUAL_PREFIX = 'visualPrefix';

export function isCommandLineInvocationToken(token: VimGrammarToken | undefined): boolean {
  return token?.kind === TOKEN_COMMAND_LINE_INVOCATION;
}

export function isCommandLineTextToken(token: VimGrammarToken | undefined): token is VimCommandLineTextToken {
  return token?.kind === TOKEN_COMMAND_LINE_TEXT;
}

export function isCountToken(token: VimGrammarToken | undefined): token is VimCountToken {
  return token?.kind === TOKEN_COUNT;
}

export function isRegisterToken(token: VimGrammarToken | undefined): token is VimRegisterToken {
  return token?.kind === TOKEN_REGISTER;
}

export function isOperatorToken(token: VimGrammarToken | undefined): token is VimOperatorToken {
  return token?.kind === TOKEN_OPERATOR;
}

export function isMotionToken(token: VimGrammarToken | undefined): token is VimMotionToken {
  return token?.kind === TOKEN_MOTION;
}

export function isTextObjectToken(token: VimGrammarToken | undefined): token is VimTextObjectToken {
  return token?.kind === TOKEN_TEXT_OBJECT;
}

export function isModeSwitchToken(token: VimGrammarToken | undefined): token is VimModeSwitchToken {
  return token?.kind === TOKEN_MODE_SWITCH;
}

export function isVisualPrefixToken(token: VimGrammarToken | undefined): token is VimVisualPrefixToken {
  return token?.kind === TOKEN_VISUAL_PREFIX;
}

export function isMacroControlToken(token: VimGrammarToken | undefined): token is VimMacroControlToken {
  return token?.kind === TOKEN_MACRO_CONTROL;
}

export function isMarkToken(token: VimGrammarToken | undefined): token is VimMarkToken {
  return token?.kind === TOKEN_MARK;
}

export function isPrefixToken(token: VimGrammarToken | undefined): boolean {
  return token?.kind === TOKEN_PREFIX;
}

export function isUnknownToken(token: VimGrammarToken | undefined): boolean {
  return token?.kind === TOKEN_UNKNOWN;
}
