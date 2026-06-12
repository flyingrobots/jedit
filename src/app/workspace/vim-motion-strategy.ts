import { VimParagraphMotionNames, type VimParagraphMotionName } from './vim-paragraph-motion.js';
import type { VimMotionName } from './vim-grammar-vocabulary.js';

export const VimMotionStrategyKinds = Object.freeze({
  MatchingPair: 1,
  Paragraph: 2,
  Primitive: 3,
  Search: 4,
  Section: 5,
} as const);
export type VimMotionStrategyKind =
  typeof VimMotionStrategyKinds[keyof typeof VimMotionStrategyKinds];

export const VimPrimitiveMotionKinds = Object.freeze({
  CharacterLeft: 1,
  CharacterRight: 2,
  FileBottom: 3,
  FileTop: 4,
  FirstNonWhitespace: 5,
  LineCurrent: 6,
  LineDown: 7,
  LineEnd: 8,
  LineStart: 9,
  LineUp: 10,
  Word: 11,
} as const);
export type VimPrimitiveMotionKind =
  typeof VimPrimitiveMotionKinds[keyof typeof VimPrimitiveMotionKinds];

export const VimMotionRangePolicies = Object.freeze({
  CurrentLine: 1,
  DirectCharwise: 2,
  IncludeLineBreak: 3,
  InclusiveCharwise: 4,
} as const);
export type VimMotionRangePolicy =
  typeof VimMotionRangePolicies[keyof typeof VimMotionRangePolicies];

export const VimMotionTargetShapeKinds = Object.freeze({
  Charwise: 1,
  Linewise: 2,
} as const);
export type VimMotionTargetShapeKind =
  typeof VimMotionTargetShapeKinds[keyof typeof VimMotionTargetShapeKinds];

interface VimMotionStrategyBase {
  readonly motion: VimMotionName;
  readonly rangePolicy: VimMotionRangePolicy;
  readonly targetShapeKind: VimMotionTargetShapeKind;
}

export interface VimMatchingPairMotionStrategy extends VimMotionStrategyBase {
  readonly kind: typeof VimMotionStrategyKinds.MatchingPair;
}

export interface VimParagraphMotionStrategy extends VimMotionStrategyBase {
  readonly kind: typeof VimMotionStrategyKinds.Paragraph;
  readonly paragraphMotion: VimParagraphMotionName;
}

export interface VimPrimitiveMotionStrategy extends VimMotionStrategyBase {
  readonly kind: typeof VimMotionStrategyKinds.Primitive;
  readonly lineStep: number;
  readonly primitiveKind: VimPrimitiveMotionKind;
}

export interface VimSearchMotionStrategy extends VimMotionStrategyBase {
  readonly kind: typeof VimMotionStrategyKinds.Search;
}

export interface VimSectionMotionStrategy extends VimMotionStrategyBase {
  readonly kind: typeof VimMotionStrategyKinds.Section;
}

export type VimMotionStrategy =
  | VimMatchingPairMotionStrategy
  | VimParagraphMotionStrategy
  | VimPrimitiveMotionStrategy
  | VimSearchMotionStrategy
  | VimSectionMotionStrategy;

export class InvalidVimMotionStrategyError extends Error {
  constructor(motion: string) {
    super(`Unsupported Vim motion strategy: ${motion}.`);
    this.name = 'InvalidVimMotionStrategyError';
  }
}

const MOTION_CHARACTER_LEFT = 'charLeft';
const MOTION_CHARACTER_RIGHT = 'charRight';
const MOTION_FILE_BOTTOM = 'fileBottom';
const MOTION_FILE_TOP = 'fileTop';
const MOTION_FIRST_NON_WHITESPACE = 'firstNonWhitespace';
const MOTION_LINE_CURRENT = 'lineCurrent';
const MOTION_LINE_DOWN = 'lineDown';
const MOTION_LINE_END = 'lineEnd';
const MOTION_LINE_START = 'lineStart';
const MOTION_LINE_UP = 'lineUp';
const MOTION_MATCHING_PAIR = 'matchingPair';
const MOTION_NEXT_SEARCH = 'nextSearch';
const MOTION_PARAGRAPH_BACKWARD = VimParagraphMotionNames.Backward;
const MOTION_PARAGRAPH_FORWARD = VimParagraphMotionNames.Forward;
const MOTION_PREVIOUS_SEARCH = 'previousSearch';
const MOTION_SECTION_BACKWARD = 'sectionBackward';
const MOTION_SECTION_FORWARD = 'sectionForward';
const MOTION_SYMBOL_BACKWARD = 'symbolBackward';
const MOTION_SYMBOL_FORWARD = 'symbolForward';
const MOTION_WORD_BACKWARD = 'wordBackward';
const MOTION_WORD_BIG_BACKWARD = 'WORDBackward';
const MOTION_WORD_BIG_END = 'WORDEnd';
const MOTION_WORD_BIG_FORWARD = 'WORDForward';
const MOTION_WORD_END = 'wordEnd';
const MOTION_WORD_FORWARD = 'wordForward';
const NO_LINE_STEP = 0;
const LINE_DOWN_STEP = 1;
const LINE_UP_STEP = -1;

const KIND_MATCHING_PAIR = VimMotionStrategyKinds.MatchingPair;
const KIND_PARAGRAPH = VimMotionStrategyKinds.Paragraph;
const KIND_PRIMITIVE = VimMotionStrategyKinds.Primitive;
const KIND_SEARCH = VimMotionStrategyKinds.Search;
const KIND_SECTION = VimMotionStrategyKinds.Section;
const RANGE_CURRENT_LINE = VimMotionRangePolicies.CurrentLine;
const RANGE_DIRECT_CHARWISE = VimMotionRangePolicies.DirectCharwise;
const RANGE_INCLUDE_LINE_BREAK = VimMotionRangePolicies.IncludeLineBreak;
const RANGE_INCLUSIVE_CHARWISE = VimMotionRangePolicies.InclusiveCharwise;
const SHAPE_CHARWISE = VimMotionTargetShapeKinds.Charwise;
const SHAPE_LINEWISE = VimMotionTargetShapeKinds.Linewise;

export function vimMotionStrategy(motion: string): VimMotionStrategy {
  return structuralMotionStrategy(motion) ??
    searchMotionStrategy(motion) ??
    paragraphMotionStrategy(motion) ??
    sectionMotionStrategy(motion) ??
    primitiveMotionStrategy(motion);
}

function structuralMotionStrategy(motion: string): VimMatchingPairMotionStrategy | undefined {
  return motion === MOTION_MATCHING_PAIR
    ? {
      kind: KIND_MATCHING_PAIR,
      motion,
      rangePolicy: RANGE_INCLUSIVE_CHARWISE,
      targetShapeKind: SHAPE_CHARWISE,
    }
    : undefined;
}

function searchMotionStrategy(motion: string): VimSearchMotionStrategy | undefined {
  return motion === MOTION_NEXT_SEARCH || motion === MOTION_PREVIOUS_SEARCH
    ? {
      kind: KIND_SEARCH,
      motion,
      rangePolicy: RANGE_DIRECT_CHARWISE,
      targetShapeKind: SHAPE_CHARWISE,
    }
    : undefined;
}

function paragraphMotionStrategy(motion: string): VimParagraphMotionStrategy | undefined {
  if (motion === MOTION_PARAGRAPH_FORWARD || motion === MOTION_PARAGRAPH_BACKWARD) {
    return {
      kind: KIND_PARAGRAPH,
      motion,
      paragraphMotion: motion,
      rangePolicy: RANGE_DIRECT_CHARWISE,
      targetShapeKind: SHAPE_CHARWISE,
    };
  }
  return undefined;
}

function sectionMotionStrategy(motion: string): VimSectionMotionStrategy | undefined {
  return motion === MOTION_SECTION_FORWARD || motion === MOTION_SECTION_BACKWARD
    ? {
      kind: KIND_SECTION,
      motion,
      rangePolicy: RANGE_DIRECT_CHARWISE,
      targetShapeKind: SHAPE_CHARWISE,
    }
    : undefined;
}

function primitiveMotionStrategy(motion: string): VimPrimitiveMotionStrategy {
  return filePrimitiveMotionStrategy(motion) ??
    characterPrimitiveMotionStrategy(motion) ??
    linePrimitiveMotionStrategy(motion) ??
    wordPrimitiveMotionStrategy(motion);
}

function filePrimitiveMotionStrategy(motion: string): VimPrimitiveMotionStrategy | undefined {
  if (motion === MOTION_FILE_TOP) {
    return primitiveLinewiseStrategy(motion, VimPrimitiveMotionKinds.FileTop);
  }
  if (motion === MOTION_FILE_BOTTOM) {
    return primitiveLinewiseStrategy(motion, VimPrimitiveMotionKinds.FileBottom);
  }
  return undefined;
}

function characterPrimitiveMotionStrategy(motion: string): VimPrimitiveMotionStrategy | undefined {
  if (motion === MOTION_CHARACTER_LEFT) {
    return primitiveCharwiseStrategy(motion, VimPrimitiveMotionKinds.CharacterLeft);
  }
  if (motion === MOTION_CHARACTER_RIGHT) {
    return primitiveCharwiseStrategy(motion, VimPrimitiveMotionKinds.CharacterRight);
  }
  return undefined;
}

function linePrimitiveMotionStrategy(motion: string): VimPrimitiveMotionStrategy | undefined {
  if (motion === MOTION_LINE_CURRENT) {
    return primitiveStrategy(motion, VimPrimitiveMotionKinds.LineCurrent, SHAPE_LINEWISE, RANGE_CURRENT_LINE);
  }
  if (motion === MOTION_LINE_DOWN) {
    return primitiveLineStepStrategy(motion, VimPrimitiveMotionKinds.LineDown, LINE_DOWN_STEP);
  }
  if (motion === MOTION_LINE_UP) {
    return primitiveLineStepStrategy(motion, VimPrimitiveMotionKinds.LineUp, LINE_UP_STEP);
  }
  return lineBoundaryPrimitiveMotionStrategy(motion);
}

function lineBoundaryPrimitiveMotionStrategy(motion: string): VimPrimitiveMotionStrategy | undefined {
  if (motion === MOTION_LINE_START) {
    return primitiveCharwiseStrategy(motion, VimPrimitiveMotionKinds.LineStart);
  }
  if (motion === MOTION_FIRST_NON_WHITESPACE) {
    return primitiveCharwiseStrategy(motion, VimPrimitiveMotionKinds.FirstNonWhitespace);
  }
  if (motion === MOTION_LINE_END) {
    return primitiveStrategy(motion, VimPrimitiveMotionKinds.LineEnd, SHAPE_CHARWISE, RANGE_INCLUDE_LINE_BREAK);
  }
  return undefined;
}

function wordPrimitiveMotionStrategy(motion: string): VimPrimitiveMotionStrategy {
  if (isWordPrimitiveMotion(motion)) {
    return primitiveStrategy(motion, VimPrimitiveMotionKinds.Word, SHAPE_CHARWISE, wordRangePolicy(motion));
  }
  throw new InvalidVimMotionStrategyError(motion);
}

function isWordPrimitiveMotion(motion: string): motion is VimMotionName {
  return motion === MOTION_WORD_BACKWARD ||
    motion === MOTION_WORD_BIG_BACKWARD ||
    motion === MOTION_WORD_BIG_END ||
    motion === MOTION_WORD_BIG_FORWARD ||
    motion === MOTION_WORD_END ||
    motion === MOTION_WORD_FORWARD ||
    motion === MOTION_SYMBOL_BACKWARD ||
    motion === MOTION_SYMBOL_FORWARD;
}

function wordRangePolicy(motion: VimMotionName): VimMotionRangePolicy {
  return motion === MOTION_WORD_END || motion === MOTION_WORD_BIG_END
    ? RANGE_INCLUDE_LINE_BREAK
    : RANGE_DIRECT_CHARWISE;
}

function primitiveCharwiseStrategy(
  motion: VimMotionName,
  primitiveKind: VimPrimitiveMotionKind,
): VimPrimitiveMotionStrategy {
  return primitiveStrategy(motion, primitiveKind, SHAPE_CHARWISE, RANGE_DIRECT_CHARWISE);
}

function primitiveLinewiseStrategy(
  motion: VimMotionName,
  primitiveKind: VimPrimitiveMotionKind,
): VimPrimitiveMotionStrategy {
  return primitiveStrategy(motion, primitiveKind, SHAPE_LINEWISE, RANGE_DIRECT_CHARWISE);
}

function primitiveLineStepStrategy(
  motion: VimMotionName,
  primitiveKind: VimPrimitiveMotionKind,
  lineStep: number,
): VimPrimitiveMotionStrategy {
  return {
    kind: KIND_PRIMITIVE,
    lineStep,
    motion,
    primitiveKind,
    rangePolicy: RANGE_DIRECT_CHARWISE,
    targetShapeKind: SHAPE_LINEWISE,
  };
}

function primitiveStrategy(
  motion: VimMotionName,
  primitiveKind: VimPrimitiveMotionKind,
  targetShapeKind: VimMotionTargetShapeKind,
  rangePolicy: VimMotionRangePolicy,
): VimPrimitiveMotionStrategy {
  return {
    kind: KIND_PRIMITIVE,
    lineStep: NO_LINE_STEP,
    motion,
    primitiveKind,
    rangePolicy,
    targetShapeKind,
  };
}
