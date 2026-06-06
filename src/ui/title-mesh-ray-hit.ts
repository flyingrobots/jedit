import { MeshVertexIndexOutOfRangeError } from "../domain/errors.js";
import type {
  TitleMesh,
  TitleMeshBounds,
  TitleMeshBvhNode,
  TitleMeshHit,
  TitleMeshVector3,
} from "./title-mesh.js";
import {
  TITLE_MESH_SIDE_MODE,
  titleMeshSideModeAcceptsDeterminant,
  type TitleMeshSideMode,
} from "./title-mesh-side-mode.js";

export interface TitleMeshHitStats {
  readonly boundsTests: number;
  readonly nodeVisits: number;
  readonly prunedChildNodes: number;
  readonly triangleTests: number;
}

export interface TitleMeshHitReport {
  readonly hit?: TitleMeshHit;
  readonly stats: TitleMeshHitStats;
}

interface MutableTitleMeshHitStats {
  boundsTests: number;
  nodeVisits: number;
  prunedChildNodes: number;
  triangleTests: number;
}

interface BoundsHit {
  readonly nearDistance: number;
}

interface ChildHit {
  readonly node: TitleMeshBvhNode;
  readonly boundsHit: BoundsHit;
}

interface TitleMeshTraceContext {
  readonly origin: TitleMeshVector3;
  readonly ray: TitleMeshVector3;
  readonly inverseRay: TitleMeshVector3;
  readonly mesh: TitleMesh;
  readonly sideMode: TitleMeshSideMode;
  readonly stats?: MutableTitleMeshHitStats;
}

const AXIS_X = 0;
const AXIS_Y = 1;
const AXIS_Z = 2;
const INTERSECTION_EPSILON = 0.000001;

export function nearestTitleMeshHit(
  origin: TitleMeshVector3,
  ray: TitleMeshVector3,
  mesh: TitleMesh,
  sideMode: TitleMeshSideMode = TITLE_MESH_SIDE_MODE.DoubleSided,
): TitleMeshHit | undefined {
  return nearestTitleMeshHitInContext(titleMeshTraceContext(origin, ray, mesh, sideMode));
}

export function nearestTitleMeshHitReport(
  origin: TitleMeshVector3,
  ray: TitleMeshVector3,
  mesh: TitleMesh,
  sideMode: TitleMeshSideMode = TITLE_MESH_SIDE_MODE.DoubleSided,
): TitleMeshHitReport {
  const stats = emptyHitStats();
  const context = titleMeshTraceContext(origin, ray, mesh, sideMode, stats);
  const hit = nearestTitleMeshHitInContext(context);
  return { ...(hit == null ? {} : { hit }), stats };
}

function nearestTitleMeshHitInContext(
  context: TitleMeshTraceContext,
): TitleMeshHit | undefined {
  let nearest: TitleMeshHit | undefined;
  visitMeshNode(context.mesh.root);
  return nearest;

  function visitMeshNode(node: TitleMeshBvhNode): void {
    incrementNodeVisits(context);
    if (rayBoundsHit(context, node.bounds, nearestDistance()) == null) {
      return;
    }
    if (node.triangleIndices.length > 0) {
      nearest = nearestMeshTriangleHit(context, node.triangleIndices, nearest);
      return;
    }
    visitMeshChildren(node);
  }

  function nearestDistance(): number {
    return nearest?.distance ?? Infinity;
  }

  function visitMeshChildren(node: TitleMeshBvhNode): void {
    const left = childHit(context, node.left, nearestDistance());
    const right = childHit(context, node.right, nearestDistance());
    const ordered = orderChildHits(left, right);
    visitChild(ordered.first);
    visitChild(ordered.second);
  }

  function visitChild(child: ChildHit | undefined): void {
    if (child == null) return;
    if (child.boundsHit.nearDistance > nearestDistance()) {
      incrementPrunedChildNodes(context);
      return;
    }
    visitMeshNode(child.node);
  }
}

function titleMeshTraceContext(
  origin: TitleMeshVector3,
  ray: TitleMeshVector3,
  mesh: TitleMesh,
  sideMode: TitleMeshSideMode,
  stats?: MutableTitleMeshHitStats,
): TitleMeshTraceContext {
  const base = {
    origin,
    ray,
    inverseRay: inverseRay(ray),
    mesh,
    sideMode,
  };
  return stats == null ? base : { ...base, stats };
}

function emptyHitStats(): MutableTitleMeshHitStats {
  return { boundsTests: 0, nodeVisits: 0, prunedChildNodes: 0, triangleTests: 0 };
}

function childHit(
  context: TitleMeshTraceContext,
  node: TitleMeshBvhNode | undefined,
  maxDistance: number,
): ChildHit | undefined {
  if (node == null) return undefined;
  const boundsHit = rayBoundsHit(context, node.bounds, maxDistance);
  return boundsHit == null ? undefined : { node, boundsHit };
}

function orderChildHits(
  first: ChildHit | undefined,
  second: ChildHit | undefined,
): { readonly first?: ChildHit; readonly second?: ChildHit } {
  if (first == null || second == null) return { first, second };
  return first.boundsHit.nearDistance <= second.boundsHit.nearDistance
    ? { first, second }
    : { first: second, second: first };
}

function nearestMeshTriangleHit(
  context: TitleMeshTraceContext,
  triangleIndices: readonly number[],
  nearest: TitleMeshHit | undefined,
): TitleMeshHit | undefined {
  let candidate = nearest;
  for (const triangleIndex of triangleIndices) {
    const hit = intersectTitleMeshTriangle(context, triangleIndex);
    if (hit != null && (candidate == null || hit.distance < candidate.distance)) {
      candidate = hit;
    }
  }
  return candidate;
}

function intersectTitleMeshTriangle(
  context: TitleMeshTraceContext,
  triangleIndex: number,
): TitleMeshHit | undefined {
  incrementTriangleTests(context);
  const indices = context.mesh.triangles[triangleIndex];
  if (indices == null) return undefined;
  const a = vertexAt(context.mesh.vertices, indices[0]);
  const b = vertexAt(context.mesh.vertices, indices[1]);
  const c = vertexAt(context.mesh.vertices, indices[2]);
  const edgeA = sub(b, a);
  const edgeB = sub(c, a);
  const rayCrossEdgeB = cross(context.ray, edgeB);
  const determinant = dot(edgeA, rayCrossEdgeB);
  if (!titleMeshSideModeAcceptsDeterminant(determinant, INTERSECTION_EPSILON, context.sideMode)) {
    return undefined;
  }

  const inverseDeterminant = 1 / determinant;
  const originToA = sub(context.origin, a);
  const barycentric = titleMeshTriangleBarycentric(
    context.ray,
    edgeA,
    originToA,
    rayCrossEdgeB,
    inverseDeterminant,
  );
  if (barycentric == null) return undefined;

  const distance = dot(edgeB, barycentric.originCrossEdgeA) * inverseDeterminant;
  return distance <= INTERSECTION_EPSILON
    ? undefined
    : titleMeshTriangleHit(distance, context.ray, edgeA, edgeB);
}

function titleMeshTriangleHit(
  distance: number,
  ray: TitleMeshVector3,
  edgeA: TitleMeshVector3,
  edgeB: TitleMeshVector3,
): TitleMeshHit {
  const normal = normalize(cross(edgeA, edgeB));
  return { distance, normal: dot(normal, ray) > 0 ? scale(normal, -1) : normal };
}

function titleMeshTriangleBarycentric(
  ray: TitleMeshVector3,
  edgeA: TitleMeshVector3,
  originToA: TitleMeshVector3,
  rayCrossEdgeB: TitleMeshVector3,
  inverseDeterminant: number,
): { readonly originCrossEdgeA: TitleMeshVector3 } | undefined {
  const u = dot(originToA, rayCrossEdgeB) * inverseDeterminant;
  if (u < 0 || u > 1) return undefined;
  const originCrossEdgeA = cross(originToA, edgeA);
  const v = dot(ray, originCrossEdgeA) * inverseDeterminant;
  return v < 0 || u + v > 1 ? undefined : { originCrossEdgeA };
}

function rayBoundsHit(
  context: TitleMeshTraceContext,
  bounds: TitleMeshBounds,
  maxDistance: number,
): BoundsHit | undefined {
  incrementBoundsTests(context);
  let nearDistance = 0;
  let farDistance = maxDistance;

  for (const axis of [AXIS_X, AXIS_Y, AXIS_Z] as const) {
    const direction = context.ray[axis];
    if (Math.abs(direction) <= INTERSECTION_EPSILON) {
      if (context.origin[axis] < bounds.min[axis] || context.origin[axis] > bounds.max[axis]) return undefined;
      continue;
    }
    const inverseDirection = context.inverseRay[axis];
    const first = (bounds.min[axis] - context.origin[axis]) * inverseDirection;
    const second = (bounds.max[axis] - context.origin[axis]) * inverseDirection;
    nearDistance = Math.max(nearDistance, Math.min(first, second));
    farDistance = Math.min(farDistance, Math.max(first, second));
    if (farDistance < nearDistance) return undefined;
  }

  return farDistance > 0 ? { nearDistance } : undefined;
}

function inverseRay(ray: TitleMeshVector3): TitleMeshVector3 {
  return [
    inverseDirection(ray[AXIS_X]),
    inverseDirection(ray[AXIS_Y]),
    inverseDirection(ray[AXIS_Z]),
  ];
}

function inverseDirection(direction: number): number {
  return Math.abs(direction) <= INTERSECTION_EPSILON ? Infinity : 1 / direction;
}

function incrementBoundsTests(context: TitleMeshTraceContext): void {
  if (context.stats != null) context.stats.boundsTests += 1;
}

function incrementNodeVisits(context: TitleMeshTraceContext): void {
  if (context.stats != null) context.stats.nodeVisits += 1;
}

function incrementPrunedChildNodes(context: TitleMeshTraceContext): void {
  if (context.stats != null) context.stats.prunedChildNodes += 1;
}

function incrementTriangleTests(context: TitleMeshTraceContext): void {
  if (context.stats != null) context.stats.triangleTests += 1;
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

function normalize(vector: TitleMeshVector3): TitleMeshVector3 {
  const length = Math.sqrt(dot(vector, vector));
  return length === 0 ? [0, 0, 0] : scale(vector, 1 / length);
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

function sub(a: TitleMeshVector3, b: TitleMeshVector3): TitleMeshVector3 {
  return [a[AXIS_X] - b[AXIS_X], a[AXIS_Y] - b[AXIS_Y], a[AXIS_Z] - b[AXIS_Z]];
}

function scale(vector: TitleMeshVector3, scalar: number): TitleMeshVector3 {
  return [
    vector[AXIS_X] * scalar,
    vector[AXIS_Y] * scalar,
    vector[AXIS_Z] * scalar,
  ];
}
