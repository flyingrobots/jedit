import type { TitleSceneVector3 } from "./title-scene.js";

export type TitleSceneColor3 = readonly [number, number, number];

const RGB_CHANNEL_MAX = 255;

export function mixColor(
  from: TitleSceneColor3,
  to: TitleSceneColor3,
  ratio: number,
): TitleSceneColor3 {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Math.round(from[0] + (to[0] - from[0]) * clamped),
    Math.round(from[1] + (to[1] - from[1]) * clamped),
    Math.round(from[2] + (to[2] - from[2]) * clamped),
  ];
}

export function mixVector(
  from: TitleSceneVector3,
  to: TitleSceneVector3,
  ratio: number,
): TitleSceneVector3 {
  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
    from[2] + (to[2] - from[2]) * ratio,
  ];
}

export function scaleColor(
  color: TitleSceneColor3,
  scalar: number,
): TitleSceneColor3 {
  return [
    Math.max(0, Math.min(RGB_CHANNEL_MAX, Math.round(color[0] * scalar))),
    Math.max(0, Math.min(RGB_CHANNEL_MAX, Math.round(color[1] * scalar))),
    Math.max(0, Math.min(RGB_CHANNEL_MAX, Math.round(color[2] * scalar))),
  ];
}

export function addColor(
  a: TitleSceneColor3,
  b: TitleSceneColor3,
): TitleSceneColor3 {
  return [
    Math.min(RGB_CHANNEL_MAX, a[0] + b[0]),
    Math.min(RGB_CHANNEL_MAX, a[1] + b[1]),
    Math.min(RGB_CHANNEL_MAX, a[2] + b[2]),
  ];
}

export function normalize(vector: TitleSceneVector3): TitleSceneVector3 {
  const length = Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2],
  );
  return length === 0
    ? [0, 0, 0]
    : [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function dot(a: TitleSceneVector3, b: TitleSceneVector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

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

export function reflect(
  ray: TitleSceneVector3,
  normal: TitleSceneVector3,
): TitleSceneVector3 {
  return sub(ray, scale(normal, 2 * dot(ray, normal)));
}
