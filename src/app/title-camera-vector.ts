import type { TitleSceneVector3 } from "../ui/title-scene.js";

const VECTOR_ZERO_EPSILON = 0.000001;
const DEFAULT_NORMAL: TitleSceneVector3 = [0, 0, -1];

export function add(
  a: TitleSceneVector3,
  b: TitleSceneVector3,
): TitleSceneVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(
  a: TitleSceneVector3,
  b: TitleSceneVector3,
): TitleSceneVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(
  vector: TitleSceneVector3,
  scalar: number,
): TitleSceneVector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

export function cross(
  a: TitleSceneVector3,
  b: TitleSceneVector3,
): TitleSceneVector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a: TitleSceneVector3, b: TitleSceneVector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length(vector: TitleSceneVector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalize(vector: TitleSceneVector3): TitleSceneVector3 {
  const magnitude = length(vector);
  return magnitude <= VECTOR_ZERO_EPSILON
    ? DEFAULT_NORMAL
    : scale(vector, 1 / magnitude);
}

export function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(value, maximum));
}
