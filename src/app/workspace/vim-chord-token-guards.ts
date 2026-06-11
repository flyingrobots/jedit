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
import { VimGrammarTokenKinds } from './vim-grammar-vocabulary.js';

export function isCommandLineInvocationToken(token: VimGrammarToken | undefined): boolean {
  return token?.kind === VimGrammarTokenKinds.CommandLineInvocation;
}

export function isCommandLineTextToken(token: VimGrammarToken | undefined): token is VimCommandLineTextToken {
  return token?.kind === VimGrammarTokenKinds.CommandLineText;
}

export function isCountToken(token: VimGrammarToken | undefined): token is VimCountToken {
  return token?.kind === VimGrammarTokenKinds.Count;
}

export function isRegisterToken(token: VimGrammarToken | undefined): token is VimRegisterToken {
  return token?.kind === VimGrammarTokenKinds.Register;
}

export function isOperatorToken(token: VimGrammarToken | undefined): token is VimOperatorToken {
  return token?.kind === VimGrammarTokenKinds.Operator;
}

export function isMotionToken(token: VimGrammarToken | undefined): token is VimMotionToken {
  return token?.kind === VimGrammarTokenKinds.Motion;
}

export function isTextObjectToken(token: VimGrammarToken | undefined): token is VimTextObjectToken {
  return token?.kind === VimGrammarTokenKinds.TextObject;
}

export function isModeSwitchToken(token: VimGrammarToken | undefined): token is VimModeSwitchToken {
  return token?.kind === VimGrammarTokenKinds.ModeSwitch;
}

export function isVisualPrefixToken(token: VimGrammarToken | undefined): token is VimVisualPrefixToken {
  return token?.kind === VimGrammarTokenKinds.VisualPrefix;
}

export function isMacroControlToken(token: VimGrammarToken | undefined): token is VimMacroControlToken {
  return token?.kind === VimGrammarTokenKinds.MacroControl;
}

export function isMarkToken(token: VimGrammarToken | undefined): token is VimMarkToken {
  return token?.kind === VimGrammarTokenKinds.Mark;
}

export function isPrefixToken(token: VimGrammarToken | undefined): boolean {
  return token?.kind === VimGrammarTokenKinds.Prefix;
}

export function isUnknownToken(token: VimGrammarToken | undefined): boolean {
  return token?.kind === VimGrammarTokenKinds.Unknown;
}
