export const TITLE_MESH_SIDE_MODE = {
  DoubleSided: "double-sided",
  FrontFacing: "front-facing",
} as const;

export type TitleMeshSideMode =
  (typeof TITLE_MESH_SIDE_MODE)[keyof typeof TITLE_MESH_SIDE_MODE];

export function titleMeshSideModeAcceptsDeterminant(
  determinant: number,
  epsilon: number,
  sideMode: TitleMeshSideMode,
): boolean {
  return sideMode === TITLE_MESH_SIDE_MODE.DoubleSided
    ? Math.abs(determinant) > epsilon
    : determinant > epsilon;
}
