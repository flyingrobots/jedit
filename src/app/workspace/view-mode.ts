export const ViewModes = Object.freeze({
  Source: 'source',
  Preview: 'preview',
} as const);

export type ViewMode = typeof ViewModes[keyof typeof ViewModes];
