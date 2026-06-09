import {
  tokenizeVimKeys,
  type VimCommandLineTextToken,
  type VimCountToken,
  type VimGrammarToken,
  type VimMacroControlName,
  type VimMacroControlToken,
  type VimModeSwitchName,
  type VimModeSwitchToken,
  type VimMotionName,
  type VimMotionToken,
  type VimOperatorName,
  type VimOperatorToken,
  type VimRegisterToken,
  type VimTextObjectScope,
  type VimTextObjectTarget,
  type VimTextObjectToken,
  type VimVisualModeName,
  type VimVisualPrefixToken,
} from './vim-grammar.js';

export type VimChordSyntaxKind = 'complete' | 'invalid' | 'pending';

export type VimChordSyntaxFamily =
  | 'commandLine'
  | 'macro'
  | 'modeSwitch'
  | 'modifier'
  | 'motion'
  | 'operatorCommand'
  | 'operatorMotion'
  | 'operatorTextObject'
  | 'prefix'
  | 'put'
  | 'textObject'
  | 'unknown'
  | 'visualPrefix';

export type VimChordObstruction =
  | 'empty'
  | 'strayTextObject'
  | 'trailingTokens'
  | 'unexpectedCommandLineToken'
  | 'unexpectedOperatorTarget'
  | 'unknownToken';

export interface VimTextObjectSyntax {
  readonly scope: VimTextObjectScope;
  readonly target: VimTextObjectTarget;
}

export interface VimCommandLineSyntax {
  readonly text: string;
}

export interface VimMacroSyntax {
  readonly control: VimMacroControlName;
  readonly register?: string;
}

export interface VimChordSyntax {
  readonly commandLine?: VimCommandLineSyntax;
  readonly count?: number;
  readonly family: VimChordSyntaxFamily;
  readonly kind: VimChordSyntaxKind;
  readonly keys: readonly string[];
  readonly macro?: VimMacroSyntax;
  readonly modeSwitch?: VimModeSwitchName;
  readonly motion?: VimMotionName;
  readonly obstruction?: VimChordObstruction;
  readonly operator?: VimOperatorName;
  readonly register?: string;
  readonly textObject?: VimTextObjectSyntax;
  readonly tokens: readonly VimGrammarToken[];
  readonly visualMode?: VimVisualModeName;
}

export const VimChordSyntaxKinds: Record<string, VimChordSyntaxKind> = Object.freeze({
  Complete: 'complete',
  Invalid: 'invalid',
  Pending: 'pending',
});

export const VimChordSyntaxFamilies: Record<string, VimChordSyntaxFamily> = Object.freeze({
  CommandLine: 'commandLine',
  Macro: 'macro',
  ModeSwitch: 'modeSwitch',
  Modifier: 'modifier',
  Motion: 'motion',
  OperatorCommand: 'operatorCommand',
  OperatorMotion: 'operatorMotion',
  OperatorTextObject: 'operatorTextObject',
  Prefix: 'prefix',
  Put: 'put',
  TextObject: 'textObject',
  Unknown: 'unknown',
  VisualPrefix: 'visualPrefix',
});

export const VimChordObstructions: Record<string, VimChordObstruction> = Object.freeze({
  Empty: 'empty',
  StrayTextObject: 'strayTextObject',
  TrailingTokens: 'trailingTokens',
  UnexpectedCommandLineToken: 'unexpectedCommandLineToken',
  UnexpectedOperatorTarget: 'unexpectedOperatorTarget',
  UnknownToken: 'unknownToken',
});

interface ParserContext {
  readonly keys: readonly string[];
  readonly modifiers: ParsedModifiers;
  readonly primaryIndex: number;
  readonly tokens: readonly VimGrammarToken[];
}

interface ParsedModifiers {
  readonly count?: number;
  readonly index: number;
  readonly register?: string;
}

interface SyntaxDraft {
  readonly commandLine?: VimCommandLineSyntax;
  readonly family: VimChordSyntaxFamily;
  readonly keys: readonly string[];
  readonly macro?: VimMacroSyntax;
  readonly modeSwitch?: VimModeSwitchName;
  readonly modifiers: ParsedModifiers;
  readonly motion?: VimMotionName;
  readonly obstruction?: VimChordObstruction;
  readonly operator?: VimOperatorName;
  readonly textObject?: VimTextObjectSyntax;
  readonly tokens: readonly VimGrammarToken[];
  readonly visualMode?: VimVisualModeName;
}

interface ModifierFields {
  readonly count?: number;
  readonly register?: string;
}

interface PayloadFields {
  readonly commandLine?: VimCommandLineSyntax;
  readonly macro?: VimMacroSyntax;
  readonly modeSwitch?: VimModeSwitchName;
  readonly motion?: VimMotionName;
  readonly obstruction?: VimChordObstruction;
  readonly operator?: VimOperatorName;
  readonly textObject?: VimTextObjectSyntax;
  readonly visualMode?: VimVisualModeName;
}

const KIND_COMPLETE: 'complete' = 'complete';
const KIND_INVALID: 'invalid' = 'invalid';
const KIND_PENDING: 'pending' = 'pending';

const FAMILY_COMMAND_LINE: 'commandLine' = 'commandLine';
const FAMILY_MACRO: 'macro' = 'macro';
const FAMILY_MODE_SWITCH: 'modeSwitch' = 'modeSwitch';
const FAMILY_MODIFIER: 'modifier' = 'modifier';
const FAMILY_MOTION: 'motion' = 'motion';
const FAMILY_OPERATOR_COMMAND: 'operatorCommand' = 'operatorCommand';
const FAMILY_OPERATOR_MOTION: 'operatorMotion' = 'operatorMotion';
const FAMILY_OPERATOR_TEXT_OBJECT: 'operatorTextObject' = 'operatorTextObject';
const FAMILY_PREFIX: 'prefix' = 'prefix';
const FAMILY_PUT: 'put' = 'put';
const FAMILY_TEXT_OBJECT: 'textObject' = 'textObject';
const FAMILY_UNKNOWN: 'unknown' = 'unknown';
const FAMILY_VISUAL_PREFIX: 'visualPrefix' = 'visualPrefix';

const OBSTRUCTION_EMPTY: 'empty' = 'empty';
const OBSTRUCTION_STRAY_TEXT_OBJECT: 'strayTextObject' = 'strayTextObject';
const OBSTRUCTION_TRAILING_TOKENS: 'trailingTokens' = 'trailingTokens';
const OBSTRUCTION_UNEXPECTED_COMMAND_LINE: 'unexpectedCommandLineToken' = 'unexpectedCommandLineToken';
const OBSTRUCTION_UNEXPECTED_OPERATOR_TARGET: 'unexpectedOperatorTarget' = 'unexpectedOperatorTarget';
const OBSTRUCTION_UNKNOWN_TOKEN: 'unknownToken' = 'unknownToken';

const TOKEN_COMMAND_LINE_INVOCATION: 'commandLineInvocation' = 'commandLineInvocation';
const TOKEN_COMMAND_LINE_TEXT: 'commandLineText' = 'commandLineText';
const TOKEN_COUNT: 'count' = 'count';
const TOKEN_MACRO_CONTROL: 'macroControl' = 'macroControl';
const TOKEN_MODE_SWITCH: 'modeSwitch' = 'modeSwitch';
const TOKEN_MOTION: 'motion' = 'motion';
const TOKEN_OPERATOR: 'operator' = 'operator';
const TOKEN_PREFIX: 'prefix' = 'prefix';
const TOKEN_REGISTER: 'register' = 'register';
const TOKEN_TEXT_OBJECT: 'textObject' = 'textObject';
const TOKEN_UNKNOWN: 'unknown' = 'unknown';
const TOKEN_VISUAL_PREFIX: 'visualPrefix' = 'visualPrefix';

const OPERATOR_PUT_AFTER: VimOperatorName = 'putAfter';
const OPERATOR_PUT_BEFORE: VimOperatorName = 'putBefore';
const STANDALONE_OPERATORS: ReadonlySet<VimOperatorName> = new Set([
  'changeToLineEnd',
  'deleteChar',
  'deleteToLineEnd',
  'joinNoSpace',
  'putAfter',
  'putBefore',
  'yankLine',
]);

const COMMAND_LINE_TEXT_INDEX = 1;
const COMMAND_LINE_COMPLETE_TOKEN_COUNT = 2;
const EMPTY_MODIFIER_FIELDS: ModifierFields = Object.freeze({});
const EMPTY_PAYLOAD_FIELDS: PayloadFields = Object.freeze({});

export function parseVimChordSyntax(keys: readonly string[]): VimChordSyntax {
  return parseTokenSyntax(tokenizeVimKeys(keys), keys.slice());
}

export function parseVimChordTokens(tokens: readonly VimGrammarToken[]): VimChordSyntax {
  return parseTokenSyntax(tokens, keysFromTokens(tokens));
}

function parseTokenSyntax(tokens: readonly VimGrammarToken[], keys: readonly string[]): VimChordSyntax {
  if (tokens.length <= 0) {
    return invalidSyntax(emptyDraft(keys, tokens));
  }
  if (isCommandLineInvocationToken(tokens[0])) {
    return parseCommandLineSyntax(keys, tokens);
  }
  const context = parserContext(keys, tokens);
  return parsePrimarySyntax(context);
}

function parsePrimarySyntax(context: ParserContext): VimChordSyntax {
  const primary = context.tokens[context.primaryIndex];
  if (primary == null) {
    return pendingSyntax(baseDraft(context, FAMILY_MODIFIER));
  }
  if (isUnknownToken(primary)) {
    return invalidSyntax(baseDraft(context, FAMILY_UNKNOWN, OBSTRUCTION_UNKNOWN_TOKEN));
  }
  if (isOperatorToken(primary)) {
    return parseOperatorSyntax(context, primary);
  }
  return parseNonOperatorSyntax(context, primary);
}

function parseNonOperatorSyntax(context: ParserContext, token: VimGrammarToken): VimChordSyntax {
  if (isMotionToken(token)) {
    return completeLeaf(context, FAMILY_MOTION, { motion: token.motion });
  }
  if (isModeSwitchToken(token)) {
    return completeLeaf(context, FAMILY_MODE_SWITCH, { modeSwitch: token.modeSwitch });
  }
  if (isVisualPrefixToken(token)) {
    return completeLeaf(context, FAMILY_VISUAL_PREFIX, { visualMode: token.visualMode });
  }
  if (isMacroControlToken(token)) {
    return completeLeaf(context, FAMILY_MACRO, { macro: macroSyntax(token) });
  }
  return parseNonActionSyntax(context, token);
}

function parseNonActionSyntax(context: ParserContext, token: VimGrammarToken): VimChordSyntax {
  if (isPrefixToken(token)) {
    return pendingSyntax(baseDraft(context, FAMILY_PREFIX));
  }
  if (isTextObjectToken(token)) {
    return invalidSyntax(textObjectDraft(context, token, OBSTRUCTION_STRAY_TEXT_OBJECT));
  }
  return invalidSyntax(baseDraft(context, FAMILY_UNKNOWN, OBSTRUCTION_UNKNOWN_TOKEN));
}

function parseOperatorSyntax(context: ParserContext, operator: VimOperatorToken): VimChordSyntax {
  const target = context.tokens[context.primaryIndex + 1];
  if (target == null) {
    return isStandaloneOperator(operator.operator)
      ? completeOperatorCommand(context, operator)
      : pendingSyntax(operatorDraft(context, operator, FAMILY_OPERATOR_COMMAND));
  }
  if (isMotionToken(target)) {
    return completeOperatorTarget(context, operator, target);
  }
  if (isTextObjectToken(target)) {
    return completeOperatorTextObject(context, operator, target);
  }
  if (isStandaloneOperator(operator.operator)) {
    return completeOperatorCommand(context, operator);
  }
  return invalidSyntax(operatorDraft(context, operator, FAMILY_OPERATOR_COMMAND, OBSTRUCTION_UNEXPECTED_OPERATOR_TARGET));
}

function completeOperatorTarget(
  context: ParserContext,
  operator: VimOperatorToken,
  motion: VimMotionToken,
): VimChordSyntax {
  return completeOrTrailing(context, context.primaryIndex + 2, {
    ...operatorDraft(context, operator, FAMILY_OPERATOR_MOTION),
    motion: motion.motion,
  });
}

function completeOperatorTextObject(
  context: ParserContext,
  operator: VimOperatorToken,
  textObject: VimTextObjectToken,
): VimChordSyntax {
  return completeOrTrailing(context, context.primaryIndex + 2, {
    ...operatorDraft(context, operator, FAMILY_OPERATOR_TEXT_OBJECT),
    textObject: textObjectSyntax(textObject),
  });
}

function completeOperatorCommand(context: ParserContext, operator: VimOperatorToken): VimChordSyntax {
  return completeOrTrailing(context, context.primaryIndex + 1, operatorDraft(context, operator, operatorFamily(operator)));
}

function completeLeaf(
  context: ParserContext,
  family: VimChordSyntaxFamily,
  payload: PayloadFields,
): VimChordSyntax {
  return completeOrTrailing(context, context.primaryIndex + 1, {
    ...baseDraft(context, family),
    ...payload,
  });
}

function completeOrTrailing(context: ParserContext, consumed: number, draft: SyntaxDraft): VimChordSyntax {
  return consumed < context.tokens.length
    ? invalidSyntax({ ...draft, obstruction: OBSTRUCTION_TRAILING_TOKENS })
    : completeSyntax(draft);
}

function parseCommandLineSyntax(keys: readonly string[], tokens: readonly VimGrammarToken[]): VimChordSyntax {
  const modifiers = { index: 0 };
  const textToken = tokens[COMMAND_LINE_TEXT_INDEX];
  const draft = { family: FAMILY_COMMAND_LINE, keys, modifiers, tokens };
  if (textToken == null) {
    return pendingSyntax(draft);
  }
  if (!isCommandLineTextToken(textToken) || tokens.length !== COMMAND_LINE_COMPLETE_TOKEN_COUNT) {
    return invalidSyntax({ ...draft, obstruction: OBSTRUCTION_UNEXPECTED_COMMAND_LINE });
  }
  return completeSyntax({ ...draft, commandLine: { text: textToken.text } });
}

function parserContext(keys: readonly string[], tokens: readonly VimGrammarToken[]): ParserContext {
  const modifiers = readModifiers(tokens);
  return { keys, modifiers, primaryIndex: modifiers.index, tokens };
}

function readModifiers(tokens: readonly VimGrammarToken[]): ParsedModifiers {
  let count: number | undefined;
  let register: string | undefined;
  let index = 0;
  while (index < tokens.length && canReadModifier(tokens[index], count, register)) {
    const token = tokens[index];
    count = isCountToken(token) ? token.value : count;
    register = isRegisterToken(token) ? token.register : register;
    index += 1;
  }
  return { count, index, register };
}

function canReadModifier(
  token: VimGrammarToken | undefined,
  count: number | undefined,
  register: string | undefined,
): boolean {
  return (isCountToken(token) && count == null) || (isRegisterToken(token) && register == null);
}

function baseDraft(
  context: ParserContext,
  family: VimChordSyntaxFamily,
  obstruction?: VimChordObstruction,
): SyntaxDraft {
  return { family, keys: context.keys, modifiers: context.modifiers, obstruction, tokens: context.tokens };
}

function emptyDraft(keys: readonly string[], tokens: readonly VimGrammarToken[]): SyntaxDraft {
  return {
    family: FAMILY_UNKNOWN,
    keys,
    modifiers: { index: 0 },
    obstruction: OBSTRUCTION_EMPTY,
    tokens,
  };
}

function operatorDraft(
  context: ParserContext,
  token: VimOperatorToken,
  family: VimChordSyntaxFamily,
  obstruction?: VimChordObstruction,
): SyntaxDraft {
  return { ...baseDraft(context, family, obstruction), operator: token.operator };
}

function textObjectDraft(
  context: ParserContext,
  token: VimTextObjectToken,
  obstruction: VimChordObstruction,
): SyntaxDraft {
  return { ...baseDraft(context, FAMILY_TEXT_OBJECT, obstruction), textObject: textObjectSyntax(token) };
}

function completeSyntax(draft: SyntaxDraft): VimChordSyntax {
  return syntaxWithKind(KIND_COMPLETE, draft);
}

function pendingSyntax(draft: SyntaxDraft): VimChordSyntax {
  return syntaxWithKind(KIND_PENDING, draft);
}

function invalidSyntax(draft: SyntaxDraft): VimChordSyntax {
  return syntaxWithKind(KIND_INVALID, draft);
}

function syntaxWithKind(kind: VimChordSyntaxKind, draft: SyntaxDraft): VimChordSyntax {
  return {
    kind,
    family: draft.family,
    keys: draft.keys,
    tokens: draft.tokens,
    ...modifierFields(draft.modifiers),
    ...payloadFields(draft),
  };
}

function modifierFields(modifiers: ParsedModifiers): ModifierFields {
  return {
    ...(modifiers.count == null ? EMPTY_MODIFIER_FIELDS : { count: modifiers.count }),
    ...(modifiers.register == null ? EMPTY_MODIFIER_FIELDS : { register: modifiers.register }),
  };
}

function payloadFields(draft: SyntaxDraft): PayloadFields {
  return {
    ...optionalField('operator', draft.operator),
    ...optionalField('motion', draft.motion),
    ...optionalField('textObject', draft.textObject),
    ...optionalField('modeSwitch', draft.modeSwitch),
    ...optionalField('visualMode', draft.visualMode),
    ...optionalField('commandLine', draft.commandLine),
    ...optionalField('macro', draft.macro),
    ...optionalField('obstruction', draft.obstruction),
  };
}

function optionalField<K extends keyof PayloadFields>(
  key: K,
  value: PayloadFields[K] | undefined,
): Pick<PayloadFields, K> | PayloadFields {
  return value == null ? EMPTY_PAYLOAD_FIELDS : { [key]: value };
}

function operatorFamily(operator: VimOperatorToken): VimChordSyntaxFamily {
  return isPutOperator(operator.operator) ? FAMILY_PUT : FAMILY_OPERATOR_COMMAND;
}

function isStandaloneOperator(operator: VimOperatorName): boolean {
  return STANDALONE_OPERATORS.has(operator);
}

function isPutOperator(operator: VimOperatorName): boolean {
  return operator === OPERATOR_PUT_AFTER || operator === OPERATOR_PUT_BEFORE;
}

function macroSyntax(token: VimMacroControlToken): VimMacroSyntax {
  return token.register == null ? { control: token.control } : { control: token.control, register: token.register };
}

function textObjectSyntax(token: VimTextObjectToken): VimTextObjectSyntax {
  return { scope: token.scope, target: token.target };
}

function keysFromTokens(tokens: readonly VimGrammarToken[]): readonly string[] {
  const keys: string[] = [];
  for (const token of tokens) {
    keys.push(...token.raw);
  }
  return keys;
}

function isCommandLineInvocationToken(token: VimGrammarToken | undefined): boolean { return token?.kind === TOKEN_COMMAND_LINE_INVOCATION; }
function isCommandLineTextToken(token: VimGrammarToken | undefined): token is VimCommandLineTextToken {
  return token?.kind === TOKEN_COMMAND_LINE_TEXT;
}
function isCountToken(token: VimGrammarToken | undefined): token is VimCountToken { return token?.kind === TOKEN_COUNT; }
function isRegisterToken(token: VimGrammarToken | undefined): token is VimRegisterToken { return token?.kind === TOKEN_REGISTER; }
function isOperatorToken(token: VimGrammarToken | undefined): token is VimOperatorToken { return token?.kind === TOKEN_OPERATOR; }
function isMotionToken(token: VimGrammarToken | undefined): token is VimMotionToken { return token?.kind === TOKEN_MOTION; }
function isTextObjectToken(token: VimGrammarToken | undefined): token is VimTextObjectToken { return token?.kind === TOKEN_TEXT_OBJECT; }
function isModeSwitchToken(token: VimGrammarToken | undefined): token is VimModeSwitchToken { return token?.kind === TOKEN_MODE_SWITCH; }
function isVisualPrefixToken(token: VimGrammarToken | undefined): token is VimVisualPrefixToken { return token?.kind === TOKEN_VISUAL_PREFIX; }
function isMacroControlToken(token: VimGrammarToken | undefined): token is VimMacroControlToken { return token?.kind === TOKEN_MACRO_CONTROL; }
function isPrefixToken(token: VimGrammarToken | undefined): boolean { return token?.kind === TOKEN_PREFIX; }
function isUnknownToken(token: VimGrammarToken | undefined): boolean { return token?.kind === TOKEN_UNKNOWN; }
