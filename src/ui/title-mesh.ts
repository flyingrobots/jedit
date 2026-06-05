import type {
  TitleMeshSource,
  TitleMeshTriangle,
  TitleMeshVector3,
} from "../ports/title-mesh.js";
import {
  EmptyMeshError,
  InvalidMeshHeightError,
  MeshTriangleIndexOutOfRangeError,
  MeshVertexIndexOutOfRangeError,
} from "../domain/errors.js";
import { validateTitleMeshWinding } from "./title-mesh-winding.js";

export type { TitleMeshSource, TitleMeshTriangle, TitleMeshVector3 };
export {
  nearestTitleMeshHit,
  nearestTitleMeshHitReport,
  type TitleMeshHitReport,
  type TitleMeshHitStats,
} from "./title-mesh-ray-hit.js";
export { TITLE_MESH_SIDE_MODE, type TitleMeshSideMode } from "./title-mesh-side-mode.js";

export interface TitleMeshBounds {
  readonly min: TitleMeshVector3;
  readonly max: TitleMeshVector3;
}

export interface TitleMesh {
  readonly vertices: readonly TitleMeshVector3[];
  readonly triangles: readonly TitleMeshTriangle[];
  readonly bounds: TitleMeshBounds;
  readonly height: number;
  readonly footprintRadius: number;
  readonly root: TitleMeshBvhNode;
}

export interface TitleMeshHit {
  readonly distance: number;
  readonly normal: TitleMeshVector3;
}

export interface TitleMeshPlacement {
  readonly height: number;
  readonly pitchRadians: number;
  readonly yawRadians: number;
  readonly centerX: number;
  readonly floorY: number;
  readonly centerZ: number;
}

interface TitleMeshTriangleData {
  readonly indices: TitleMeshTriangle;
  readonly bounds: TitleMeshBounds;
  readonly center: TitleMeshVector3;
}

export interface TitleMeshBvhNode {
  readonly bounds: TitleMeshBounds;
  readonly triangleIndices: readonly number[];
  readonly left?: TitleMeshBvhNode;
  readonly right?: TitleMeshBvhNode;
}

type Axis = typeof AXIS_X | typeof AXIS_Y | typeof AXIS_Z;

const AXIS_X = 0;
const AXIS_Y = 1;
const AXIS_Z = 2;
const ZERO_RADIANS = 0;
const BVH_LEAF_TRIANGLE_COUNT = 8;
const EMPTY_TRIANGLE_INDICES: readonly number[] = [];

export function createTitleMesh(
  source: TitleMeshSource,
  placement: TitleMeshPlacement,
): TitleMesh {
  const orientedVertices = source.vertices.map((vertex) =>
    pitchVertex(vertex, placement.pitchRadians),
  );
  const sourceBounds = boundsForVertices(orientedVertices);
  const vertices = orientedVertices.map((vertex) =>
    transformVertex(vertex, sourceBounds, placement),
  );
  const triangles = source.triangles.map((indices) =>
    triangleData(vertices, indices),
  );
  const meshTriangles = triangles.map((triangle) => triangle.indices);
  validateTitleMeshWinding(vertices, meshTriangles);
  if (triangles.length === 0) {
    throw new EmptyMeshError("Title mesh must contain at least one triangle.");
  }

  const triangleIndices = triangles.map((_, index) => index);
  const bounds = boundsForVertices(vertices);
  return {
    vertices,
    triangles: meshTriangles,
    bounds,
    height: bounds.max[AXIS_Y] - bounds.min[AXIS_Y],
    footprintRadius: footprintRadiusForVertices(
      vertices,
      placement.centerX,
      placement.centerZ,
    ),
    root: buildBvhNode(triangles, triangleIndices),
  };
}

function pitchVertex(
  vertex: TitleMeshVector3,
  radians: number,
): TitleMeshVector3 {
  if (radians === ZERO_RADIANS) {
    return vertex;
  }
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    vertex[AXIS_X],
    vertex[AXIS_Y] * cos - vertex[AXIS_Z] * sin,
    vertex[AXIS_Y] * sin + vertex[AXIS_Z] * cos,
  ];
}

function transformVertex(
  vertex: TitleMeshVector3,
  bounds: TitleMeshBounds,
  placement: TitleMeshPlacement,
): TitleMeshVector3 {
  const sourceHeight = bounds.max[AXIS_Y] - bounds.min[AXIS_Y];
  if (sourceHeight <= 0) {
    throw new InvalidMeshHeightError(
      "Title mesh source height must be greater than zero.",
    );
  }

  const sourceCenterX = (bounds.min[AXIS_X] + bounds.max[AXIS_X]) / 2;
  const sourceCenterZ = (bounds.min[AXIS_Z] + bounds.max[AXIS_Z]) / 2;
  const scale = placement.height / sourceHeight;
  const x = (vertex[AXIS_X] - sourceCenterX) * scale;
  const y = (vertex[AXIS_Y] - bounds.min[AXIS_Y]) * scale + placement.floorY;
  const z = (vertex[AXIS_Z] - sourceCenterZ) * scale;
  const cos = Math.cos(placement.yawRadians);
  const sin = Math.sin(placement.yawRadians);

  return [
    placement.centerX + (x * cos - z * sin),
    y,
    placement.centerZ + (x * sin + z * cos),
  ];
}

function buildBvhNode(
  triangles: readonly TitleMeshTriangleData[],
  triangleIndices: readonly number[],
): TitleMeshBvhNode {
  const bounds = boundsForTriangles(triangles, triangleIndices);
  if (triangleIndices.length <= BVH_LEAF_TRIANGLE_COUNT) {
    return { bounds, triangleIndices };
  }

  const axis = widestAxis(bounds);
  const sorted = [...triangleIndices].sort(
    (left, right) =>
      triangleAt(triangles, left).center[axis] -
      triangleAt(triangles, right).center[axis],
  );
  const split = Math.floor(sorted.length / 2);
  const leftIndices = sorted.slice(0, split);
  const rightIndices = sorted.slice(split);
  if (leftIndices.length === 0 || rightIndices.length === 0) {
    return { bounds, triangleIndices };
  }

  return {
    bounds,
    triangleIndices: EMPTY_TRIANGLE_INDICES,
    left: buildBvhNode(triangles, leftIndices),
    right: buildBvhNode(triangles, rightIndices),
  };
}

function triangleData(
  vertices: readonly TitleMeshVector3[],
  indices: TitleMeshTriangle,
): TitleMeshTriangleData {
  const a = vertexAt(vertices, indices[0]);
  const b = vertexAt(vertices, indices[1]);
  const c = vertexAt(vertices, indices[2]);
  const bounds = boundsForVertices([a, b, c]);
  return {
    indices,
    bounds,
    center: [
      (a[AXIS_X] + b[AXIS_X] + c[AXIS_X]) / 3,
      (a[AXIS_Y] + b[AXIS_Y] + c[AXIS_Y]) / 3,
      (a[AXIS_Z] + b[AXIS_Z] + c[AXIS_Z]) / 3,
    ],
  };
}

function boundsForTriangles(
  triangles: readonly TitleMeshTriangleData[],
  indices: readonly number[],
): TitleMeshBounds {
  const first = triangleAt(triangles, indices[0] ?? -1).bounds;
  let min = first.min;
  let max = first.max;
  for (const index of indices.slice(1)) {
    const bounds = triangleAt(triangles, index).bounds;
    min = minVector(min, bounds.min);
    max = maxVector(max, bounds.max);
  }
  return { min, max };
}

function boundsForVertices(
  vertices: readonly TitleMeshVector3[],
): TitleMeshBounds {
  const first = vertices[0];
  if (first == null) {
    throw new EmptyMeshError("Title mesh must contain at least one vertex.");
  }

  let min = first;
  let max = first;
  for (const vertex of vertices.slice(1)) {
    min = minVector(min, vertex);
    max = maxVector(max, vertex);
  }
  return { min, max };
}

function footprintRadiusForVertices(
  vertices: readonly TitleMeshVector3[],
  centerX: number,
  centerZ: number,
): number {
  let radius = 0;
  for (const vertex of vertices) {
    const x = vertex[AXIS_X] - centerX;
    const z = vertex[AXIS_Z] - centerZ;
    radius = Math.max(radius, Math.sqrt(x * x + z * z));
  }
  return radius;
}

function widestAxis(bounds: TitleMeshBounds): Axis {
  const width = bounds.max[AXIS_X] - bounds.min[AXIS_X];
  const height = bounds.max[AXIS_Y] - bounds.min[AXIS_Y];
  const depth = bounds.max[AXIS_Z] - bounds.min[AXIS_Z];
  if (height >= width && height >= depth) {
    return AXIS_Y;
  }
  return depth >= width ? AXIS_Z : AXIS_X;
}

function triangleAt(
  triangles: readonly TitleMeshTriangleData[],
  index: number,
): TitleMeshTriangleData {
  const triangle = triangles[index];
  if (triangle == null) {
    throw new MeshTriangleIndexOutOfRangeError(
      "Title mesh triangle index is out of range.",
    );
  }
  return triangle;
}

function vertexAt(
  vertices: readonly TitleMeshVector3[],
  index: number,
): TitleMeshVector3 {
  const vertex = vertices[index];
  if (vertex == null) {
    throw new MeshVertexIndexOutOfRangeError(
      "Title mesh vertex index is out of range.",
    );
  }
  return vertex;
}

function minVector(a: TitleMeshVector3, b: TitleMeshVector3): TitleMeshVector3 {
  return [
    Math.min(a[AXIS_X], b[AXIS_X]),
    Math.min(a[AXIS_Y], b[AXIS_Y]),
    Math.min(a[AXIS_Z], b[AXIS_Z]),
  ];
}

function maxVector(a: TitleMeshVector3, b: TitleMeshVector3): TitleMeshVector3 {
  return [
    Math.max(a[AXIS_X], b[AXIS_X]),
    Math.max(a[AXIS_Y], b[AXIS_Y]),
    Math.max(a[AXIS_Z], b[AXIS_Z]),
  ];
}
