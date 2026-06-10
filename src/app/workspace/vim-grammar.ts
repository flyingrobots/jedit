import {
  COMMAND_LINE_ACCEPT_KEY,
  COMMAND_LINE_PREFIX,
  COUNT_MAX,
  COUNT_MIN,
  DOUBLE_MOTIONS,
  G_OPERATORS,
  INCOMPLETE_PREFIX_KEYS,
  LINEWISE_OPERATOR_KEYS,
  MACRO_RECORD_KEY,
  MACRO_REPLAY_KEY,
  MARK_EXACT_JUMP_KEY,
  MARK_LINE_JUMP_KEY,
  MARK_NAMES,
  MARK_SET_KEY,
  MODE_SWITCHES,
  REGISTER_NAMES,
  REGISTER_PREFIX,
  SINGLE_MOTIONS,
  SINGLE_OPERATORS,
  TEXT_OBJECT_AROUND_PREFIX,
  TEXT_OBJECT_AROUND_SCOPE,
  TEXT_OBJECT_INNER_PREFIX,
  TEXT_OBJECT_INNER_SCOPE,
  TEXT_OBJECTS,
  VISUAL_PREFIXES,
  ZERO_KEY,
  type VimCommandLineInvocationToken,
  type VimCommandLineTextToken,
  type VimCountToken,
  type VimGrammarToken,
  type VimMacroControlName,
  type VimMacroControlToken,
  type VimMarkActionName,
  type VimMarkToken,
  type VimModeSwitchName,
  type VimModeSwitchToken,
  type VimMotionName,
  type VimMotionToken,
  type VimOperatorName,
  type VimOperatorToken,
  type VimPrefixToken,
  type VimRegisterToken,
  type VimTextObjectScope,
  type VimTextObjectTarget,
  type VimTextObjectToken,
  type VimUnknownToken,
  type VimVisualModeName,
  type VimVisualPrefixToken,
} from './vim-grammar-vocabulary.js';

export {
  COMMAND_LINE_ACCEPT_KEY,
  VimGrammarTokenKinds,
  type VimCommandLineInvocationToken,
  type VimCommandLineTextToken,
  type VimCountToken,
  type VimGrammarToken,
  type VimMacroControlName,
  type VimMacroControlToken,
  type VimMarkActionName,
  type VimMarkToken,
  type VimModeSwitchName,
  type VimModeSwitchToken,
  type VimMotionName,
  type VimMotionToken,
  type VimOperatorName,
  type VimOperatorToken,
  type VimPrefixToken,
  type VimRegisterToken,
  type VimTextObjectScope,
  type VimTextObjectTarget,
  type VimTextObjectToken,
  type VimUnknownToken,
  type VimVisualModeName,
  type VimVisualPrefixToken,
} from './vim-grammar-vocabulary.js';

interface TokenRead {
  readonly nextIndex: number;
  readonly tokens: readonly VimGrammarToken[];
}

type TokenReader = (keys: readonly string[], index: number) => TokenRead | undefined;
type KeyTokenReader = (key: string, index: number) => TokenRead | undefined;

const TOKEN_READERS: readonly TokenReader[] = [
  readCommandLine,
  readCount,
  readRegister,
  readTextObject,
  readMacro,
  readMark,
  readDoubleMotion,
  readGOperator,
  readLineOperator,
];

const MAPPED_TOKEN_READERS: readonly KeyTokenReader[] = [
  mappedOperator,
  mappedMotion,
  mappedModeSwitch,
  mappedVisualPrefix,
  readPrefix,
];

export function tokenizeVimKeys(keys: readonly string[]): readonly VimGrammarToken[] {
  const tokens: VimGrammarToken[] = [];
  let index = 0;
  while (index < keys.length) {
    const read = readToken(keys, index);
    tokens.push(...read.tokens);
    index = read.nextIndex;
  }
  return tokens;
}

function readToken(keys: readonly string[], index: number): TokenRead {
  for (const reader of TOKEN_READERS) {
    const read = reader(keys, index);
    if (read != null) {
      return read;
    }
  }
  return readMappedToken(keys[index] ?? '', index) ?? singleToken(unknownToken(keys[index] ?? '', index), index + 1);
}

function readCommandLine(keys: readonly string[], index: number): TokenRead | undefined {
  if (keys[index] !== COMMAND_LINE_PREFIX) {
    return undefined;
  }
  const tokens: VimGrammarToken[] = [commandLineInvocationToken(index)];
  const raw = keys.slice(index + 1);
  if (raw.length > 0) {
    tokens.push(commandLineTextToken(raw, index + 1));
  }
  return { tokens, nextIndex: keys.length };
}

function readCount(keys: readonly string[], index: number): TokenRead | undefined {
  const key = keys[index] ?? '';
  if (!isCountStartKey(key)) {
    return undefined;
  }
  const raw = countRaw(keys, index);
  return singleToken(countToken(raw, index), index + raw.length);
}

function readRegister(keys: readonly string[], index: number): TokenRead | undefined {
  if (keys[index] !== REGISTER_PREFIX) {
    return undefined;
  }
  const name = keys[index + 1];
  if (name == null || !REGISTER_NAMES.has(name)) {
    return singleToken(prefixToken(REGISTER_PREFIX, index), index + 1);
  }
  return singleToken(registerToken(name, index), index + 2);
}

function readTextObject(keys: readonly string[], index: number): TokenRead | undefined {
  const scope = textObjectScope(keys[index]);
  const target = TEXT_OBJECTS.get(keys[index + 1] ?? '');
  if (scope == null || target == null) {
    return undefined;
  }
  return singleToken(textObjectToken(scope, target, keys.slice(index, index + 2), index), index + 2);
}

function readMacro(keys: readonly string[], index: number): TokenRead | undefined {
  const key = keys[index] ?? '';
  const next = keys[index + 1];
  if (key === MACRO_REPLAY_KEY) {
    return readMacroReplay(next, index);
  }
  if (key !== MACRO_RECORD_KEY) {
    return undefined;
  }
  return next != null && REGISTER_NAMES.has(next)
    ? singleToken(macroToken('record', [key, next], index, next), index + 2)
    : singleToken(prefixToken(key, index), index + 1);
}

function readMark(keys: readonly string[], index: number): TokenRead | undefined {
  const key = keys[index] ?? '';
  const next = keys[index + 1];
  if (!isMarkPrefix(key)) {
    return undefined;
  }
  if (next == null) {
    return singleToken(prefixToken(key, index), index + 1);
  }
  if (!MARK_NAMES.has(next)) {
    return undefined;
  }
  return singleToken(markToken(markAction(key), [key, next], index, next), index + 2);
}

function readMacroReplay(next: string | undefined, index: number): TokenRead {
  if (next === MACRO_REPLAY_KEY) {
    return singleToken(macroToken('replayLast', [MACRO_REPLAY_KEY, next], index), index + 2);
  }
  return next != null && REGISTER_NAMES.has(next)
    ? singleToken(macroToken('replay', [MACRO_REPLAY_KEY, next], index, next), index + 2)
    : singleToken(prefixToken(MACRO_REPLAY_KEY, index), index + 1);
}

function readDoubleMotion(keys: readonly string[], index: number): TokenRead | undefined {
  const raw = `${keys[index] ?? ''}${keys[index + 1] ?? ''}`;
  const motion = DOUBLE_MOTIONS.get(raw);
  return motion == null ? undefined : singleToken(motionToken(motion, raw.split(''), index), index + 2);
}

function readGOperator(keys: readonly string[], index: number): TokenRead | undefined {
  const raw = `${keys[index] ?? ''}${keys[index + 1] ?? ''}`;
  const operator = G_OPERATORS.get(raw);
  return operator == null ? undefined : singleToken(operatorToken(operator, raw.split(''), index), index + 2);
}

function readLineOperator(keys: readonly string[], index: number): TokenRead | undefined {
  const key = keys[index] ?? '';
  const operator = SINGLE_OPERATORS.get(key);
  if (operator == null || keys[index + 1] !== key || !LINEWISE_OPERATOR_KEYS.has(key)) {
    return undefined;
  }
  return {
    tokens: [operatorToken(operator, [key], index), motionToken('lineCurrent', [key], index + 1)],
    nextIndex: index + 2,
  };
}

function readMappedToken(key: string, index: number): TokenRead | undefined {
  for (const reader of MAPPED_TOKEN_READERS) {
    const read = reader(key, index);
    if (read != null) {
      return read;
    }
  }
  return undefined;
}

function mappedOperator(key: string, index: number): TokenRead | undefined {
  const operator = SINGLE_OPERATORS.get(key);
  return operator == null ? undefined : singleToken(operatorToken(operator, [key], index), index + 1);
}

function mappedMotion(key: string, index: number): TokenRead | undefined {
  const motion = SINGLE_MOTIONS.get(key);
  return motion == null ? undefined : singleToken(motionToken(motion, [key], index), index + 1);
}

function mappedModeSwitch(key: string, index: number): TokenRead | undefined {
  const modeSwitch = MODE_SWITCHES.get(key);
  return modeSwitch == null ? undefined : singleToken(modeSwitchToken(modeSwitch, key, index), index + 1);
}

function mappedVisualPrefix(key: string, index: number): TokenRead | undefined {
  const visualMode = VISUAL_PREFIXES.get(key);
  return visualMode == null ? undefined : singleToken(visualPrefixToken(visualMode, key, index), index + 1);
}

function readPrefix(key: string, index: number): TokenRead | undefined {
  return INCOMPLETE_PREFIX_KEYS.has(key) ? singleToken(prefixToken(key, index), index + 1) : undefined;
}

function singleToken(token: VimGrammarToken, nextIndex: number): TokenRead {
  return { tokens: [token], nextIndex };
}

function countRaw(keys: readonly string[], index: number): readonly string[] {
  const raw: string[] = [];
  let cursor = index;
  while (isDigitKey(keys[cursor] ?? '')) {
    raw.push(keys[cursor] ?? '');
    cursor += 1;
  }
  return raw;
}

function isDigitKey(key: string): boolean {
  return key >= ZERO_KEY && key <= COUNT_MAX;
}

function isCountStartKey(key: string): boolean {
  return key >= COUNT_MIN && key <= COUNT_MAX;
}

function textObjectScope(key: string | undefined): VimTextObjectScope | undefined {
  if (key === TEXT_OBJECT_AROUND_PREFIX) {
    return TEXT_OBJECT_AROUND_SCOPE;
  }
  return key === TEXT_OBJECT_INNER_PREFIX ? TEXT_OBJECT_INNER_SCOPE : undefined;
}

function isMarkPrefix(key: string): boolean {
  return key === MARK_SET_KEY || key === MARK_EXACT_JUMP_KEY || key === MARK_LINE_JUMP_KEY;
}

function markAction(key: string): VimMarkActionName {
  if (key === MARK_EXACT_JUMP_KEY) {
    return 'jumpExact';
  }
  return key === MARK_LINE_JUMP_KEY ? 'jumpLine' : 'set';
}

function countToken(raw: readonly string[], at: number): VimCountToken {
  return { kind: 'count', raw, at, value: Number(raw.join('')) };
}

function registerToken(register: string, at: number): VimRegisterToken {
  return { kind: 'register', raw: [REGISTER_PREFIX, register], at, register };
}

function operatorToken(operator: VimOperatorName, raw: readonly string[], at: number): VimOperatorToken {
  return { kind: 'operator', raw, at, operator };
}

function motionToken(motion: VimMotionName, raw: readonly string[], at: number): VimMotionToken {
  return { kind: 'motion', raw, at, motion };
}

function textObjectToken(
  scope: VimTextObjectScope,
  target: VimTextObjectTarget,
  raw: readonly string[],
  at: number,
): VimTextObjectToken {
  return { kind: 'textObject', raw, at, scope, target };
}

function modeSwitchToken(modeSwitch: VimModeSwitchName, key: string, at: number): VimModeSwitchToken {
  return { kind: 'modeSwitch', raw: [key], at, modeSwitch };
}

function visualPrefixToken(visualMode: VimVisualModeName, key: string, at: number): VimVisualPrefixToken {
  return { kind: 'visualPrefix', raw: [key], at, visualMode };
}

function commandLineInvocationToken(at: number): VimCommandLineInvocationToken {
  return { kind: 'commandLineInvocation', raw: [COMMAND_LINE_PREFIX], at };
}

function commandLineTextToken(raw: readonly string[], at: number): VimCommandLineTextToken {
  return { kind: 'commandLineText', raw, at, text: commandLineText(raw) };
}

function commandLineText(raw: readonly string[]): string {
  return raw[raw.length - 1] === COMMAND_LINE_ACCEPT_KEY ? raw.slice(0, -1).join('') : raw.join('');
}

function macroToken(
  control: VimMacroControlName,
  raw: readonly string[],
  at: number,
  register?: string,
): VimMacroControlToken {
  return register == null ? { kind: 'macroControl', raw, at, control } : { kind: 'macroControl', raw, at, control, register };
}

function markToken(
  action: VimMarkActionName,
  raw: readonly string[],
  at: number,
  mark: string,
): VimMarkToken {
  return { kind: 'mark', raw, at, action, mark };
}

function prefixToken(prefix: string, at: number): VimPrefixToken {
  return { kind: 'prefix', raw: [prefix], at, prefix };
}

function unknownToken(key: string, at: number): VimUnknownToken {
  return { kind: 'unknown', raw: [key], at };
}
