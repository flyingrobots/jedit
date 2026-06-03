export const EditorKeys = Object.freeze({
  Escape: 'escape',
  Left: 'left',
  Right: 'right',
  Up: 'up',
  Down: 'down',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Backspace: 'backspace',
  Delete: 'delete',
  Enter: 'enter',
  Space: 'space',
  Tab: 'tab',
  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
  E: 'e',
  G: 'g',
  H: 'h',
  I: 'i',
  J: 'j',
  K: 'k',
  L: 'l',
  O: 'o',
  P: 'p',
  R: 'r',
  U: 'u',
  W: 'w',
  X: 'x',
  Y: 'y',
  LineStart: '0',
  LineEnd: '$',
  FirstNonWhitespace: '^',
} as const);

export type EditorKey = typeof EditorKeys[keyof typeof EditorKeys];

export const PastePlacements = Object.freeze({
  Before: 'before',
  After: 'after',
} as const);

export type PastePlacement = typeof PastePlacements[keyof typeof PastePlacements];

export const WordMotions = Object.freeze({
  Start: 'w',
  End: 'e',
} as const);

export type WordMotion = typeof WordMotions[keyof typeof WordMotions];

export const LineBoundaries = Object.freeze({
  Start: 'start',
  End: 'end',
} as const);

export type LineBoundary = typeof LineBoundaries[keyof typeof LineBoundaries];
