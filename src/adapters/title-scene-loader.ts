import * as fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SceneDecodeError, SceneLoadError } from "../domain/errors.js";
import {
  type TitleScene,
  type TitleSceneCameraPlacement,
  type TitleSceneObject,
  type TitleSceneVector3,
} from "../ui/title-scene.js";
import {
  TITLE_SCENE_DEFAULT_CAMERA_ANGLE,
  TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
  TITLE_SCENE_DEFAULT_CAMERA_TARGET,
  titleSceneCameraPlacementFromPosition,
} from "../ui/title-scene-camera.js";
import type { TitleMeshLibrary } from "../ui/title-mesh-library.js";
import { titleSceneObjectFootprintCenterAt } from "../ui/title-scene-transform.js";
import {
  BUILT_IN_TITLE_SCENE_NAMES,
  type BuiltInTitleSceneName,
  type TitleSceneLoaderPort,
} from "../ports/title-scene-loader.js";
import { decodeTitleSceneEnvironment } from "./title-scene-environment-decoder.js";
import { decodeSceneObject } from "./title-scene-object-decoder.js";
import {
  arrayAt,
  objectAt,
  optionalFiniteNumber,
  optionalNonNegativeNumber,
  optionalString,
  parseJsonText,
  vectorAt,
  type JsonObject,
  type JsonValue,
} from "./title-scene-json-decoder.js";

interface DecodedCameraTarget {
  readonly target?: TitleSceneVector3;
}

export interface TitleSceneLoaderOptions {
  readonly builtInSceneDirectories?: readonly string[];
}

const EMPTY_DIRECTION_LENGTH = 0;
const BUILT_IN_TITLE_SCENE_SET = new Set<string>(BUILT_IN_TITLE_SCENE_NAMES);
const BUILT_IN_SCENE_CANDIDATE_URLS = [
  (name: BuiltInTitleSceneName): URL =>
    new URL(`../scenes/${name}`, import.meta.url),
  (name: BuiltInTitleSceneName): URL =>
    new URL(`../../scenes/${name}`, import.meta.url),
] as const;

export async function loadTitleSceneFromFile(
  path: string,
  meshes: TitleMeshLibrary,
): Promise<TitleScene> {
  const content = await fs.readFile(path, "utf8");
  return parseTitleSceneText(content, meshes);
}

export function loadBuiltInTitleSceneSync(
  name: BuiltInTitleSceneName,
  meshes: TitleMeshLibrary,
): TitleScene {
  if (!BUILT_IN_TITLE_SCENE_SET.has(name)) {
    throw new SceneDecodeError(`Unknown built-in scene '${name}'.`);
  }
  return parseTitleSceneText(
    readFileSync(resolveBuiltInTitleScenePath(name, undefined), "utf8"),
    meshes,
  );
}

function parseTitleSceneText(
  content: string,
  meshes: TitleMeshLibrary,
): TitleScene {
  let json: JsonValue;
  try {
    json = parseJsonText(content);
  } catch (error) {
    throw new SceneDecodeError(
      `Scene JSON is malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseTitleSceneJson(json, meshes);
}

export async function loadBuiltInTitleScene(
  name: BuiltInTitleSceneName,
  meshes: TitleMeshLibrary,
): Promise<TitleScene> {
  if (!BUILT_IN_TITLE_SCENE_SET.has(name)) {
    throw new SceneDecodeError(`Unknown built-in scene '${name}'.`);
  }
  return loadTitleSceneFromFile(
    resolveBuiltInTitleScenePath(name, undefined),
    meshes,
  );
}

export function parseTitleSceneJson(
  json: JsonValue,
  meshes: TitleMeshLibrary,
): TitleScene {
  const root = objectAt(json, "scene");
  const environment = decodeTitleSceneEnvironment(root["environment"]);
  const objects = arrayAt(root["objects"] ?? [], "scene.objects").map(
    (objectJson, index) =>
      decodeSceneObject(objectJson, meshes, `scene.objects[${index}]`),
  );
  const camera = decodeCamera(root["camera"], objects);

  return { camera, objects, environment };
}

export function createTitleSceneLoaderPort(
  options: TitleSceneLoaderOptions = {},
): TitleSceneLoaderPort {
  return {
    loadTitleSceneFromFile,
    loadBuiltInTitleScene: async (name, meshes) => {
      if (!BUILT_IN_TITLE_SCENE_SET.has(name)) {
        throw new SceneDecodeError(`Unknown built-in scene '${name}'.`);
      }
      return loadTitleSceneFromFile(
        resolveBuiltInTitleScenePath(name, options.builtInSceneDirectories),
        meshes,
      );
    },
  };
}

function decodeCamera(
  value: JsonValue | undefined,
  objects: readonly TitleSceneObject[],
): TitleSceneCameraPlacement {
  if (value == null) {
    return {
      angle: TITLE_SCENE_DEFAULT_CAMERA_ANGLE,
      radius: TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
    };
  }
  const camera = objectAt(value, "scene.camera");
  const position = optionalVector(camera["position"], "scene.camera.position");
  const target = decodeCameraTarget(camera, position, objects).target;
  if (position != null) {
    return titleSceneCameraPlacementFromPosition(
      position,
      target ?? TITLE_SCENE_DEFAULT_CAMERA_TARGET,
    );
  }
  return {
    angle:
      optionalFiniteNumber(camera["angle"], "scene.camera.angle") ??
      TITLE_SCENE_DEFAULT_CAMERA_ANGLE,
    radius:
      optionalNonNegativeNumber(camera["radius"], "scene.camera.radius") ??
      TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
    ...(target == null ? {} : { target }),
  };
}

function decodeCameraTarget(
  camera: JsonObject,
  position: TitleSceneVector3 | undefined,
  objects: readonly TitleSceneObject[],
): DecodedCameraTarget {
  const target = optionalVector(camera["target"], "scene.camera.target");
  const direction = optionalVector(
    camera["direction"],
    "scene.camera.direction",
  );
  const targetObject = optionalString(
    camera["targetObject"],
    "scene.camera.targetObject",
  );
  const sourceCount = cameraTargetSourceCount(target, direction, targetObject);
  if (sourceCount > 1) {
    throw new SceneDecodeError(
      "scene.camera must define only one of target, direction, or targetObject.",
    );
  }
  if (target != null) {
    return { target };
  }
  if (direction != null) {
    return { target: cameraDirectionTarget(position, direction) };
  }
  if (targetObject != null) {
    return { target: cameraTargetObjectCenter(objects, targetObject) };
  }
  return {};
}

function cameraTargetSourceCount(
  target: TitleSceneVector3 | undefined,
  direction: TitleSceneVector3 | undefined,
  targetObject: string | undefined,
): number {
  return (
    (target == null ? 0 : 1) +
    (direction == null ? 0 : 1) +
    (targetObject == null ? 0 : 1)
  );
}

function cameraDirectionTarget(
  position: TitleSceneVector3 | undefined,
  direction: TitleSceneVector3,
): TitleSceneVector3 {
  if (position == null) {
    throw new SceneDecodeError(
      "scene.camera.direction requires scene.camera.position.",
    );
  }
  if (vectorLength(direction) === EMPTY_DIRECTION_LENGTH) {
    throw new SceneDecodeError("scene.camera.direction must not be zero.");
  }
  return addNormalizedDirection(position, direction);
}

function cameraTargetObjectCenter(
  objects: readonly TitleSceneObject[],
  label: string,
): TitleSceneVector3 {
  const matches = objects.filter((object) => object.label === label);
  if (matches.length !== 1) {
    throw new SceneDecodeError(
      `scene.camera.targetObject must match exactly one object label: ${label}.`,
    );
  }
  return titleSceneObjectFootprintCenterAt(matches[0]!);
}

function optionalVector(
  value: JsonValue | undefined,
  path: string,
): TitleSceneVector3 | undefined {
  return value == null ? undefined : vectorAt(value, path);
}

function vectorLength(vector: TitleSceneVector3): number {
  return Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2],
  );
}

function addNormalizedDirection(
  position: TitleSceneVector3,
  direction: TitleSceneVector3,
): TitleSceneVector3 {
  const length = vectorLength(direction);
  return [
    position[0] + direction[0] / length,
    position[1] + direction[1] / length,
    position[2] + direction[2] / length,
  ];
}

function resolveBuiltInTitleScenePath(
  name: BuiltInTitleSceneName,
  directories: readonly string[] | undefined,
): string {
  const candidates = builtInSceneCandidates(name, directories);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new SceneLoadError(
    `Built-in scene asset is unavailable: ${candidates.join(", ")}`,
  );
}

function builtInSceneCandidates(
  name: BuiltInTitleSceneName,
  directories: readonly string[] | undefined,
): readonly string[] {
  if (directories != null && directories.length > 0) {
    return directories.map((directory) => path.join(directory, name));
  }
  return BUILT_IN_SCENE_CANDIDATE_URLS.map((candidate) =>
    fileURLToPath(candidate(name)),
  );
}
