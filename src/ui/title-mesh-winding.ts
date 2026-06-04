import {
  MeshInconsistentWindingError,
  MeshInvertedWindingError,
} from "../domain/errors.js";
import type { TitleMeshTriangle, TitleMeshVector3 } from "../ports/title-mesh.js";

interface TitleMeshDirectedEdge {
  readonly from: number;
  readonly to: number;
}

interface TitleMeshEdgeWinding {
  readonly forwardCount: number;
  readonly backwardCount: number;
  readonly totalCount: number;
}

const AXIS_X = 0;
const AXIS_Y = 1;
const AXIS_Z = 2;
const TRIANGLE_FIRST_EDGE_START = 0;
const TRIANGLE_SECOND_EDGE_START = 1;
const TRIANGLE_THIRD_EDGE_START = 2;
const TRIANGLE_FIRST_EDGE_END = 1;
const TRIANGLE_SECOND_EDGE_END = 2;
const TRIANGLE_THIRD_EDGE_END = 0;
const MANIFOLD_SHARED_EDGE_USE_COUNT = 2;
const BOUNDARY_EDGE_USE_COUNT = 1;
const EMPTY_SIGNED_VOLUME = 0;
const SIGNED_VOLUME_SIMPLEX_DIVISOR = 6;
const POSITIVE_VOLUME_EPSILON = 0.000000001;
const EDGE_KEY_SEPARATOR = ":";

export function validateTitleMeshWinding(
  vertices: readonly TitleMeshVector3[],
  triangles: readonly TitleMeshTriangle[],
): void {
  const edgeWindings = titleMeshEdgeWindings(triangles);
  rejectInconsistentSharedEdges(edgeWindings);
  rejectGloballyInvertedClosedMesh(vertices, triangles, edgeWindings);
}

function rejectInconsistentSharedEdges(
  edgeWindings: ReadonlyMap<string, TitleMeshEdgeWinding>,
): void {
  for (const edgeWinding of edgeWindings.values()) {
    if (titleMeshEdgeHasInconsistentWinding(edgeWinding)) {
      throw new MeshInconsistentWindingError(
        "Title mesh contains adjacent triangles with inconsistent winding.",
      );
    }
  }
}

function titleMeshEdgeHasInconsistentWinding(
  edgeWinding: TitleMeshEdgeWinding,
): boolean {
  if (edgeWinding.totalCount === BOUNDARY_EDGE_USE_COUNT) {
    return false;
  }
  if (edgeWinding.totalCount !== MANIFOLD_SHARED_EDGE_USE_COUNT) {
    return edgeWinding.forwardCount === 0 || edgeWinding.backwardCount === 0;
  }
  return edgeWinding.forwardCount !== edgeWinding.backwardCount;
}

function rejectGloballyInvertedClosedMesh(
  vertices: readonly TitleMeshVector3[],
  triangles: readonly TitleMeshTriangle[],
  edgeWindings: ReadonlyMap<string, TitleMeshEdgeWinding>,
): void {
  if (!titleMeshHasClosedEdges(edgeWindings)) {
    return;
  }
  if (titleMeshSignedVolume(vertices, triangles) <= POSITIVE_VOLUME_EPSILON) {
    throw new MeshInvertedWindingError(
      "Title mesh closed surface has inward-facing winding.",
    );
  }
}

function titleMeshHasClosedEdges(
  edgeWindings: ReadonlyMap<string, TitleMeshEdgeWinding>,
): boolean {
  for (const edgeWinding of edgeWindings.values()) {
    if (edgeWinding.totalCount === BOUNDARY_EDGE_USE_COUNT) {
      return false;
    }
  }
  return edgeWindings.size > 0;
}

function titleMeshEdgeWindings(
  triangles: readonly TitleMeshTriangle[],
): ReadonlyMap<string, TitleMeshEdgeWinding> {
  const windings = new Map<string, TitleMeshEdgeWinding>();
  for (const triangle of triangles) {
    for (const edge of titleMeshTriangleEdges(triangle)) {
      windings.set(titleMeshEdgeKey(edge), titleMeshUpdatedEdgeWinding(edge));
    }
  }
  return windings;

  function titleMeshUpdatedEdgeWinding(
    edge: TitleMeshDirectedEdge,
  ): TitleMeshEdgeWinding {
    const key = titleMeshEdgeKey(edge);
    const current = windings.get(key);
    return {
      forwardCount:
        (current?.forwardCount ?? 0) + titleMeshForwardEdgeIncrement(edge),
      backwardCount:
        (current?.backwardCount ?? 0) + titleMeshBackwardEdgeIncrement(edge),
      totalCount: (current?.totalCount ?? 0) + 1,
    };
  }
}

function titleMeshTriangleEdges(
  triangle: TitleMeshTriangle,
): readonly TitleMeshDirectedEdge[] {
  return [
    {
      from: triangle[TRIANGLE_FIRST_EDGE_START],
      to: triangle[TRIANGLE_FIRST_EDGE_END],
    },
    {
      from: triangle[TRIANGLE_SECOND_EDGE_START],
      to: triangle[TRIANGLE_SECOND_EDGE_END],
    },
    {
      from: triangle[TRIANGLE_THIRD_EDGE_START],
      to: triangle[TRIANGLE_THIRD_EDGE_END],
    },
  ];
}

function titleMeshForwardEdgeIncrement(edge: TitleMeshDirectedEdge): number {
  return edge.from < edge.to ? 1 : 0;
}

function titleMeshBackwardEdgeIncrement(edge: TitleMeshDirectedEdge): number {
  return edge.from < edge.to ? 0 : 1;
}

function titleMeshEdgeKey(edge: TitleMeshDirectedEdge): string {
  const first = Math.min(edge.from, edge.to);
  const second = Math.max(edge.from, edge.to);
  return `${first}${EDGE_KEY_SEPARATOR}${second}`;
}

function titleMeshSignedVolume(
  vertices: readonly TitleMeshVector3[],
  triangles: readonly TitleMeshTriangle[],
): number {
  let volume = EMPTY_SIGNED_VOLUME;
  for (const triangle of triangles) {
    volume += titleMeshTriangleSignedVolume(vertices, triangle);
  }
  return volume;
}

function titleMeshTriangleSignedVolume(
  vertices: readonly TitleMeshVector3[],
  triangle: TitleMeshTriangle,
): number {
  const a = vertices[triangle[0]];
  const b = vertices[triangle[1]];
  const c = vertices[triangle[2]];
  if (a == null || b == null || c == null) {
    return EMPTY_SIGNED_VOLUME;
  }
  return dot(a, cross(b, c)) / SIGNED_VOLUME_SIMPLEX_DIVISOR;
}

function dot(a: TitleMeshVector3, b: TitleMeshVector3): number {
  return a[AXIS_X] * b[AXIS_X] + a[AXIS_Y] * b[AXIS_Y] + a[AXIS_Z] * b[AXIS_Z];
}

function cross(a: TitleMeshVector3, b: TitleMeshVector3): TitleMeshVector3 {
  return [
    a[AXIS_Y] * b[AXIS_Z] - a[AXIS_Z] * b[AXIS_Y],
    a[AXIS_Z] * b[AXIS_X] - a[AXIS_X] * b[AXIS_Z],
    a[AXIS_X] * b[AXIS_Y] - a[AXIS_Y] * b[AXIS_X],
  ];
}
