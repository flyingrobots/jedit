import {
  COMMAND_LINE_ACCEPT_KEY,
  tokenizeVimKeys,
  type VimGrammarToken,
  type VimMacroControlName,
  type VimMacroControlToken,
  type VimMarkToken,
  type VimModeSwitchName,
  type VimMotionName,
  type VimMotionToken,
  type VimOperatorName,
  type VimOperatorToken,
  type VimTextObjectScope,
  type VimTextObjectTarget,
  type VimTextObjectToken,
  type VimVisualModeName,
} from './vim-grammar.js';
import {
  isCommandLineInvocationToken,
  isCommandLineTextToken,
  isCountToken,
  isMacroControlToken,
  isMarkToken,
  isModeSwitchToken,
  isMotionToken,
  isOperatorToken,
  isPrefixToken,
  isRegisterToken,
  isTextObjectToken,
  isUnknownToken,
  isVisualPrefixToken,
} from './vim-chord-token-guards.js';
import {
  TEXT_OBJECT_AROUND_PREFIX,
  TEXT_OBJECT_INNER_PREFIX,
  VimOperatorNames,
} from './vim-grammar-vocabulary.js';

export type VimChordSyntaxKind = 'complete' | 'invalid' | 'pending';

export type VimChordSyntaxFamily = 'commandLine' | 'macro' | 'mark' | 'modeSwitch' | 'modifier' | 'motion' | 'operatorCommand'
  | 'operatorMotion' | 'operatorTextObject' | 'prefix' | 'put' | 'textObject' | 'unknown' | 'visualPrefix';

export type VimChordObstruction = 'empty' | 'strayTextObject' | 'trailingTokens' | 'unexpectedCommandLineToken'
  | 'unexpectedOperatorTarget' | 'unknownToken';

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

export type VimMarkSyntax = Pick<VimMarkToken, 'action' | 'mark'>;

export interface VimChordSyntax {
  readonly commandLine?: VimCommandLineSyntax;
  readonly count?: number;
  readonly family: VimChordSyntaxFamily;
  readonly kind: VimChordSyntaxKind;
  readonly keys: readonly string[];
  readonly macro?: VimMacroSyntax;
  readonly mark?: VimMarkSyntax;
  readonly modeSwitch?: VimModeSwitchName;
  readonly motion?: VimMotionName;
  readonly obstruction?: VimChordObstruction;
  readonly operator?: VimOperatorName;
  readonly register?: string;
  readonly textObject?: VimTextObjectSyntax;
  readonly tokens: readonly VimGrammarToken[];
  readonly visualMode?: VimVisualModeName;
}

export const VimChordSyntaxKinds = Object.freeze({
  Complete: 'complete',
  Invalid: 'invalid',
  Pending: 'pending',
} as const satisfies Record<string, VimChordSyntaxKind>);

export const VimChordSyntaxFamilies = Object.freeze({
  CommandLine: 'commandLine',
  Macro: 'macro',
  Mark: 'mark',
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
} as const satisfies Record<string, VimChordSyntaxFamily>);

export const VimChordObstructions = Object.freeze({
  Empty: 'empty',
  StrayTextObject: 'strayTextObject',
  TrailingTokens: 'trailingTokens',
  UnexpectedCommandLineToken: 'unexpectedCommandLineToken',
  UnexpectedOperatorTarget: 'unexpectedOperatorTarget',
  UnknownToken: 'unknownToken',
} as const satisfies Record<string, VimChordObstruction>);

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
  readonly mark?: VimMarkSyntax;
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
  readonly mark?: VimMarkSyntax;
  readonly modeSwitch?: VimModeSwitchName;
  readonly motion?: VimMotionName;
  readonly obstruction?: VimChordObstruction;
  readonly operator?: VimOperatorName;
  readonly textObject?: VimTextObjectSyntax;
  readonly visualMode?: VimVisualModeName;
}

const KIND_COMPLETE = VimChordSyntaxKinds.Complete;
const KIND_INVALID = VimChordSyntaxKinds.Invalid;
const KIND_PENDING = VimChordSyntaxKinds.Pending;

const FAMILY_COMMAND_LINE = VimChordSyntaxFamilies.CommandLine;
const FAMILY_MACRO = VimChordSyntaxFamilies.Macro;
const FAMILY_MARK = VimChordSyntaxFamilies.Mark;
const FAMILY_MODE_SWITCH = VimChordSyntaxFamilies.ModeSwitch;
const FAMILY_MODIFIER = VimChordSyntaxFamilies.Modifier;
const FAMILY_MOTION = VimChordSyntaxFamilies.Motion;
const FAMILY_OPERATOR_COMMAND = VimChordSyntaxFamilies.OperatorCommand;
const FAMILY_OPERATOR_MOTION = VimChordSyntaxFamilies.OperatorMotion;
const FAMILY_OPERATOR_TEXT_OBJECT = VimChordSyntaxFamilies.OperatorTextObject;
const FAMILY_PREFIX = VimChordSyntaxFamilies.Prefix;
const FAMILY_PUT = VimChordSyntaxFamilies.Put;
const FAMILY_TEXT_OBJECT = VimChordSyntaxFamilies.TextObject;
const FAMILY_UNKNOWN = VimChordSyntaxFamilies.Unknown;
const FAMILY_VISUAL_PREFIX = VimChordSyntaxFamilies.VisualPrefix;

const OBSTRUCTION_EMPTY = VimChordObstructions.Empty;
const OBSTRUCTION_STRAY_TEXT_OBJECT = VimChordObstructions.StrayTextObject;
const OBSTRUCTION_TRAILING_TOKENS = VimChordObstructions.TrailingTokens;
const OBSTRUCTION_UNEXPECTED_COMMAND_LINE = VimChordObstructions.UnexpectedCommandLineToken;
const OBSTRUCTION_UNEXPECTED_OPERATOR_TARGET = VimChordObstructions.UnexpectedOperatorTarget;
const OBSTRUCTION_UNKNOWN_TOKEN = VimChordObstructions.UnknownToken;

const OPERATOR_PUT_AFTER = VimOperatorNames.PutAfter;
const OPERATOR_PUT_BEFORE = VimOperatorNames.PutBefore;
const STANDALONE_OPERATORS: ReadonlySet<VimOperatorName> = new Set([
  VimOperatorNames.ChangeToLineEnd,
  VimOperatorNames.DeleteChar,
  VimOperatorNames.DeleteToLineEnd,
  VimOperatorNames.JoinNoSpace,
  VimOperatorNames.JoinWithSpace,
  VimOperatorNames.PutAfter,
  VimOperatorNames.PutBefore,
  VimOperatorNames.YankLine,
]);

const COMMAND_LINE_TEXT_INDEX = 1;
const COMMAND_LINE_COMPLETE_TOKEN_COUNT = 2;
const COMMAND_LINE_ACCEPT_MISSING = -1;
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
  if (isMarkToken(token)) {
    return completeLeaf(context, FAMILY_MARK, { mark: markSyntax(token) });
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
  if (!isStandaloneOperator(operator.operator) && isPendingTextObjectScopeToken(target)) {
    return pendingSyntax(operatorDraft(context, operator, FAMILY_OPERATOR_COMMAND));
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
  const acceptIndex = commandLineAcceptIndex(textToken.raw);
  if (acceptIndex === COMMAND_LINE_ACCEPT_MISSING) {
    return pendingSyntax({ ...draft, commandLine: { text: textToken.text } });
  }
  if (acceptIndex < textToken.raw.length - 1) {
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
    ...optionalField('mark', draft.mark),
    ...optionalField('obstruction', draft.obstruction),
  };
}

function optionalField<K extends keyof PayloadFields>(
  key: K,
  value: PayloadFields[K] | undefined,
): Pick<PayloadFields, K> | PayloadFields {
  return value == null ? EMPTY_PAYLOAD_FIELDS : { [key]: value };
}

function commandLineAcceptIndex(raw: readonly string[]): number {
  return raw.indexOf(COMMAND_LINE_ACCEPT_KEY);
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

function isPendingTextObjectScopeToken(token: VimGrammarToken | undefined): boolean {
  return token?.raw[0] === TEXT_OBJECT_AROUND_PREFIX || token?.raw[0] === TEXT_OBJECT_INNER_PREFIX;
}

function macroSyntax(token: VimMacroControlToken): VimMacroSyntax {
  return token.register == null ? { control: token.control } : { control: token.control, register: token.register };
}

function markSyntax(token: VimMarkToken): VimMarkSyntax {
  return { action: token.action, mark: token.mark };
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
