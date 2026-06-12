import { VimSearchDirections, type VimSearchDirection, type VimSearchState } from './editor/model.js';
import type { VimMotionName } from './vim-grammar-vocabulary.js';
import { vimMotionBasisDigest } from './vim-motion-basis-digest.js';

export type VimSearchPatternKind = 'literal';
export type VimSearchPolicy = 'literal-wrap-v1';

export interface VimSearchMatchMotion {
  readonly direction: VimSearchDirection;
  readonly end: number;
  readonly matchId: string;
  readonly matchOrdinal: number;
  readonly patternDigest: string;
  readonly patternKind: VimSearchPatternKind;
  readonly policy: VimSearchPolicy;
  readonly searchId?: string;
  readonly start: number;
}

export interface VimSearchMotionDestination {
  readonly destination: number;
  readonly searchMatch: VimSearchMatchMotion;
}

interface LiteralSearchMatch {
  readonly end: number;
  readonly matchOrdinal: number;
  readonly start: number;
}

const DEFAULT_COUNT = 1;
const EMPTY_LENGTH = 0;
const FIRST_INDEX = 0;
const MISSING_INDEX = -1;
const NEXT_INDEX = 1;
const DIRECTION_BACKWARD = VimSearchDirections.Backward;
const DIRECTION_FORWARD = VimSearchDirections.Forward;
const MOTION_NEXT_SEARCH: VimMotionName = 'nextSearch';
const MOTION_PREVIOUS_SEARCH: VimMotionName = 'previousSearch';
const PATTERN_KIND_LITERAL: VimSearchPatternKind = 'literal';
const POLICY_LITERAL_WRAP: VimSearchPolicy = 'literal-wrap-v1';
const SEARCH_MATCH_ID_PREFIX = 'vim-search-match';

export function vimSearchMotionDestination(
  text: string,
  cursorIndex: number,
  motion: VimMotionName,
  count: number,
  lastSearch: VimSearchState | undefined,
): VimSearchMotionDestination | undefined {
  if (lastSearch == null || lastSearch.pattern.length === EMPTY_LENGTH) {
    return undefined;
  }
  const direction = repeatDirection(motion, lastSearch.direction);
  if (direction == null) {
    return undefined;
  }
  return countedSearchDestination({
    count: Math.max(DEFAULT_COUNT, count),
    cursorIndex,
    direction,
    lastSearch,
    matches: literalSearchMatches(text, lastSearch.pattern),
  });
}

function countedSearchDestination(request: {
  readonly count: number;
  readonly cursorIndex: number;
  readonly direction: VimSearchDirection;
  readonly lastSearch: VimSearchState;
  readonly matches: readonly LiteralSearchMatch[];
}): VimSearchMotionDestination | undefined {
  if (request.matches.length === EMPTY_LENGTH) {
    return undefined;
  }

  let cursor = request.cursorIndex;
  let selected: LiteralSearchMatch | undefined;
  for (let step = FIRST_INDEX; step < request.count; step += NEXT_INDEX) {
    selected = request.direction === DIRECTION_FORWARD
      ? nextForwardMatch(request.matches, cursor)
      : nextBackwardMatch(request.matches, cursor);
    if (selected == null) {
      return undefined;
    }
    cursor = selected.start;
  }

  return selected == null
    ? undefined
    : searchDestination(request.lastSearch, request.direction, selected);
}

function searchDestination(
  lastSearch: VimSearchState,
  direction: VimSearchDirection,
  match: LiteralSearchMatch,
): VimSearchMotionDestination {
  const patternDigest = vimMotionBasisDigest([lastSearch.pattern]);
  const searchMatch = {
    direction,
    end: match.end,
    matchId: searchMatchId(patternDigest, match),
    matchOrdinal: match.matchOrdinal,
    patternDigest,
    patternKind: PATTERN_KIND_LITERAL,
    policy: POLICY_LITERAL_WRAP,
    ...(lastSearch.searchId == null ? {} : { searchId: lastSearch.searchId }),
    start: match.start,
  };
  return {
    destination: match.start,
    searchMatch,
  };
}

function repeatDirection(
  motion: VimMotionName,
  lastDirection: VimSearchDirection,
): VimSearchDirection | undefined {
  if (motion === MOTION_NEXT_SEARCH) {
    return lastDirection;
  }
  if (motion === MOTION_PREVIOUS_SEARCH) {
    return oppositeDirection(lastDirection);
  }
  return undefined;
}

function oppositeDirection(direction: VimSearchDirection): VimSearchDirection {
  return direction === DIRECTION_FORWARD ? DIRECTION_BACKWARD : DIRECTION_FORWARD;
}

function literalSearchMatches(text: string, pattern: string): readonly LiteralSearchMatch[] {
  const matches: LiteralSearchMatch[] = [];
  let fromIndex = FIRST_INDEX;
  while (fromIndex <= text.length) {
    const start = text.indexOf(pattern, fromIndex);
    if (start === MISSING_INDEX) {
      return matches;
    }
    matches.push({
      end: start + pattern.length,
      matchOrdinal: matches.length + NEXT_INDEX,
      start,
    });
    fromIndex = start + NEXT_INDEX;
  }
  return matches;
}

function nextForwardMatch(
  matches: readonly LiteralSearchMatch[],
  cursorIndex: number,
): LiteralSearchMatch | undefined {
  return matches.find((match) => match.start > cursorIndex) ?? matches[FIRST_INDEX];
}

function nextBackwardMatch(
  matches: readonly LiteralSearchMatch[],
  cursorIndex: number,
): LiteralSearchMatch | undefined {
  for (let index = matches.length - NEXT_INDEX; index >= FIRST_INDEX; index -= NEXT_INDEX) {
    const match = matches[index];
    if (match != null && match.start < cursorIndex) {
      return match;
    }
  }
  return matches[matches.length - NEXT_INDEX];
}

function searchMatchId(
  patternDigest: string,
  match: LiteralSearchMatch,
): string {
  return `${SEARCH_MATCH_ID_PREFIX}:${patternDigest}:${match.start}:${match.end}:${match.matchOrdinal}`;
}
