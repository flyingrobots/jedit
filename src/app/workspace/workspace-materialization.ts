const MATERIALIZED = 'materialized';
const UNMATERIALIZED = 'unmaterialized';
const NO_PROJECTION = 'no-projection';

export const WorkspaceMaterializationKinds = Object.freeze({
  Materialized: MATERIALIZED,
  Unmaterialized: UNMATERIALIZED,
  NoProjection: NO_PROJECTION,
} as const);

export type WorkspaceMaterializationKind =
  typeof WorkspaceMaterializationKinds[keyof typeof WorkspaceMaterializationKinds];

export function workspaceMaterialization(
  editorDirty: boolean | undefined,
): WorkspaceMaterializationKind {
  if (editorDirty == null) {
    return WorkspaceMaterializationKinds.NoProjection;
  }
  return editorDirty
    ? WorkspaceMaterializationKinds.Unmaterialized
    : WorkspaceMaterializationKinds.Materialized;
}
