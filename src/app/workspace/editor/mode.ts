export const EditorModes = Object.freeze({
  Normal: 'normal',
  Insert: 'insert',
} as const);

export const PendingNormals = Object.freeze({
  Change: 'c',
  Delete: 'd',
  GoTo: 'g',
  Yank: 'y',
} as const);

export const PendingOperators = Object.freeze({
  Change: 'change',
  Delete: 'delete',
  Yank: 'yank',
} as const);

export type EditorMode = typeof EditorModes[keyof typeof EditorModes];
export type PendingNormal = typeof PendingNormals[keyof typeof PendingNormals];
export type PendingOperator = typeof PendingOperators[keyof typeof PendingOperators];
