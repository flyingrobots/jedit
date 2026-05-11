export type TitleMeshVector3 = readonly [number, number, number];
export type TitleMeshTriangle = readonly [number, number, number];

export interface TitleMeshSource {
  readonly vertices: readonly TitleMeshVector3[];
  readonly triangles: readonly TitleMeshTriangle[];
}
