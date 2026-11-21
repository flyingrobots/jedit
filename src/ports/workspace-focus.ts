export const FocusPanes = Object.freeze({ Editor: 'editor', Files: 'files', Graft: 'graft' } as const);
export type FocusPane = typeof FocusPanes[keyof typeof FocusPanes];
