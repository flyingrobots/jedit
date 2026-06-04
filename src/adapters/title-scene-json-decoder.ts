import { SceneDecodeError } from "../domain/errors.js";
import type { TitleSceneVector3 } from "../ui/title-scene.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue | undefined };

const VECTOR_LENGTH = 3;
const COLOR_CHANNEL_MIN = 0;
const COLOR_CHANNEL_MAX = 255;

export function parseJsonText(content: string): JsonValue {
  return JSON.parse(content);
}

export function objectAt(
  value: JsonValue | undefined,
  path: string,
): JsonObject {
  if (!isJsonObject(value)) {
    throw new SceneDecodeError(`${path} must be an object.`);
  }
  return value;
}

export function arrayAt(
  value: JsonValue | undefined,
  path: string,
): readonly JsonValue[] {
  if (!Array.isArray(value)) {
    throw new SceneDecodeError(`${path} must be an array.`);
  }
  return value;
}

export function finiteNumberAt(
  value: JsonValue | undefined,
  path: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SceneDecodeError(`${path} must be a finite number.`);
  }
  return value;
}

export function optionalFiniteNumber(
  value: JsonValue | undefined,
  path: string,
): number | undefined {
  return value == null ? undefined : finiteNumberAt(value, path);
}

export function optionalString(
  value: JsonValue | undefined,
  path: string,
): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new SceneDecodeError(`${path} must be a string.`);
  }
  return value;
}

export function nonNegativeNumberAt(
  value: JsonValue | undefined,
  path: string,
): number {
  const number = finiteNumberAt(value, path);
  if (number < 0) {
    throw new SceneDecodeError(`${path} must be non-negative.`);
  }
  return number;
}

export function optionalNonNegativeNumber(
  value: JsonValue | undefined,
  path: string,
): number | undefined {
  return value == null ? undefined : nonNegativeNumberAt(value, path);
}

export function vectorAt(
  value: JsonValue | undefined,
  path: string,
): TitleSceneVector3 {
  const vector = arrayAt(value, path);
  if (vector.length !== VECTOR_LENGTH) {
    throw new SceneDecodeError(
      `${path} must contain exactly ${VECTOR_LENGTH} finite numbers.`,
    );
  }
  return [
    finiteNumberAt(vector[0], `${path}[0]`),
    finiteNumberAt(vector[1], `${path}[1]`),
    finiteNumberAt(vector[2], `${path}[2]`),
  ];
}

export function colorAt(
  value: JsonValue | undefined,
  path: string,
): readonly [number, number, number] {
  const color = vectorAt(value, path);
  for (let index = 0; index < color.length; index += 1) {
    const channel = color[index]!;
    if (channel < COLOR_CHANNEL_MIN || channel > COLOR_CHANNEL_MAX) {
      throw new SceneDecodeError(
        `${path}[${index}] must be between ${COLOR_CHANNEL_MIN} and ${COLOR_CHANNEL_MAX}.`,
      );
    }
  }
  return color;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
