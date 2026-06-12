import { lineStartTextIndex } from './editor-editing-core.js';

export type VimMatchingPairDirection = 'backward' | 'forward';
export type VimMatchingPairPolicy = 'balanced-bracket-pair-v1';

export interface VimStructuralPairMotion {
  readonly close: string;
  readonly closeIndex: number;
  readonly direction: VimMatchingPairDirection;
  readonly open: string;
  readonly openIndex: number;
  readonly originIndex: number;
  readonly pairId: string;
  readonly policy: VimMatchingPairPolicy;
}

export interface VimMatchingPairMotionDestination {
  readonly destination: number;
  readonly structuralPair: VimStructuralPairMotion;
}

interface DelimiterPair {
  readonly close: string;
  readonly open: string;
}

interface DelimiterCandidate {
  readonly pair: DelimiterPair;
  readonly role: DelimiterRole;
  readonly textIndex: number;
}

type DelimiterRole = 'close' | 'open';

const FIRST_INDEX = 0;
const NEXT_INDEX = 1;
const EMPTY_LENGTH = 0;
const LINE_BREAK_TEXT = '\n';
const PAIR_ID_PREFIX = 'vim-pair';
const POLICY_BALANCED_BRACKET_PAIR: VimMatchingPairPolicy = 'balanced-bracket-pair-v1';
const DIRECTION_BACKWARD: VimMatchingPairDirection = 'backward';
const DIRECTION_FORWARD: VimMatchingPairDirection = 'forward';
const ROLE_CLOSE: DelimiterRole = 'close';
const ROLE_OPEN: DelimiterRole = 'open';

const DELIMITER_PAIRS: readonly DelimiterPair[] = Object.freeze([
  Object.freeze({ open: '(', close: ')' }),
  Object.freeze({ open: '[', close: ']' }),
  Object.freeze({ open: '{', close: '}' }),
]);

const OPEN_DELIMITERS = delimiterMap(ROLE_OPEN);
const CLOSE_DELIMITERS = delimiterMap(ROLE_CLOSE);

export function vimMatchingPairMotionDestination(
  lines: readonly string[],
  startRow: number,
  startColumn: number,
): VimMatchingPairMotionDestination | undefined {
  const candidate = delimiterCandidateAtOrAfterCursor(lines, startRow, startColumn);
  if (candidate == null) {
    return undefined;
  }
  const text = lines.join(LINE_BREAK_TEXT);
  return candidate.role === ROLE_OPEN
    ? matchingPairForward(text, candidate)
    : matchingPairBackward(text, candidate);
}

function delimiterCandidateAtOrAfterCursor(
  lines: readonly string[],
  startRow: number,
  startColumn: number,
): DelimiterCandidate | undefined {
  const line = lines[startRow] ?? '';
  const lineStart = lineStartTextIndex(lines, startRow);
  for (let column = Math.max(FIRST_INDEX, startColumn); column < line.length; column += NEXT_INDEX) {
    const pair = pairForOpenDelimiter(line[column]) ?? pairForCloseDelimiter(line[column]);
    if (pair != null) {
      return {
        pair,
        role: pair.open === line[column] ? ROLE_OPEN : ROLE_CLOSE,
        textIndex: lineStart + column,
      };
    }
  }
  return undefined;
}

function matchingPairForward(
  text: string,
  candidate: DelimiterCandidate,
): VimMatchingPairMotionDestination | undefined {
  let depth = EMPTY_LENGTH;
  for (let index = candidate.textIndex; index < text.length; index += NEXT_INDEX) {
    if (text[index] === candidate.pair.open) {
      depth += NEXT_INDEX;
    } else if (text[index] === candidate.pair.close) {
      depth -= NEXT_INDEX;
      if (depth === EMPTY_LENGTH) {
        return destination(candidate, candidate.textIndex, index, DIRECTION_FORWARD);
      }
    }
  }
  return undefined;
}

function matchingPairBackward(
  text: string,
  candidate: DelimiterCandidate,
): VimMatchingPairMotionDestination | undefined {
  let depth = EMPTY_LENGTH;
  for (let index = candidate.textIndex; index >= FIRST_INDEX; index -= NEXT_INDEX) {
    if (text[index] === candidate.pair.close) {
      depth += NEXT_INDEX;
    } else if (text[index] === candidate.pair.open) {
      depth -= NEXT_INDEX;
      if (depth === EMPTY_LENGTH) {
        return destination(candidate, index, candidate.textIndex, DIRECTION_BACKWARD);
      }
    }
  }
  return undefined;
}

function destination(
  candidate: DelimiterCandidate,
  openIndex: number,
  closeIndex: number,
  direction: VimMatchingPairDirection,
): VimMatchingPairMotionDestination {
  const structuralPair = {
    close: candidate.pair.close,
    closeIndex,
    direction,
    open: candidate.pair.open,
    openIndex,
    originIndex: candidate.textIndex,
    pairId: pairId(candidate.pair, openIndex, closeIndex),
    policy: POLICY_BALANCED_BRACKET_PAIR,
  };
  return {
    destination: direction === DIRECTION_FORWARD ? closeIndex : openIndex,
    structuralPair,
  };
}

function pairId(pair: DelimiterPair, openIndex: number, closeIndex: number): string {
  return `${PAIR_ID_PREFIX}:${openIndex}:${closeIndex}:${pair.open}${pair.close}`;
}

function pairForOpenDelimiter(delimiter: string | undefined): DelimiterPair | undefined {
  return delimiter == null ? undefined : OPEN_DELIMITERS.get(delimiter);
}

function pairForCloseDelimiter(delimiter: string | undefined): DelimiterPair | undefined {
  return delimiter == null ? undefined : CLOSE_DELIMITERS.get(delimiter);
}

function delimiterMap(role: DelimiterRole): ReadonlyMap<string, DelimiterPair> {
  return new Map(DELIMITER_PAIRS.map((pair) => [
    role === ROLE_OPEN ? pair.open : pair.close,
    pair,
  ]));
}
