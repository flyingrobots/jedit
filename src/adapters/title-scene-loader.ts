import * as fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SceneDecodeError, SceneLoadError } from "../domain/errors.js";
import {
  TITLE_SCENE_SHAPE_KIND,
  type TitleScene,
  type TitleSceneCameraPlacement,
  type TitleSceneObject,
  type TitleScenePrimitiveShapeKind,
  type TitleSceneVector3,
} from "../ui/title-scene.js";
import {
  TITLE_SCENE_DEFAULT_CAMERA_ANGLE,
  TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
  TITLE_SCENE_DEFAULT_CAMERA_TARGET,
  titleSceneCameraPlacementFromPosition,
} from "../ui/title-scene-camera.js";
import {
  TITLE_MESH_ID,
  type TitleMeshId,
  type TitleMeshLibrary,
} from "../ui/title-mesh-library.js";
import type { TitleMesh } from "../ui/title-mesh.js";
import { titleSceneObjectFootprintCenterAt } from "../ui/title-scene-transform.js";
import {
  BUILT_IN_TITLE_SCENE_NAMES,
  type BuiltInTitleSceneName,
  type TitleSceneLoaderPort,
} from "../ports/title-scene-loader.js";
import { decodeTitleSceneEnvironment } from "./title-scene-environment-decoder.js";
import {
  arrayAt,
  colorAt,
  finiteNumberAt,
  nonNegativeNumberAt,
  objectAt,
  optionalFiniteNumber,
  optionalNonNegativeNumber,
  optionalString,
  parseJsonText,
  vectorAt,
  type JsonObject,
  type JsonValue,
} from "./title-scene-json-decoder.js";

interface DecodedOpticalMaterial {
  readonly transparency?: number;
  readonly refractiveIndex?: number;
}
interface DecodedSceneObjectMetadata {
  readonly label?: string;
}
interface DecodedCameraTarget {
  readonly target?: TitleSceneVector3;
}

export interface TitleSceneLoaderOptions {
  readonly builtInSceneDirectories?: readonly string[];
}

const MATERIAL_RATIO_MIN = 0;
const MATERIAL_RATIO_MAX = 1;
const REFRACTIVE_INDEX_MIN = 1;
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

function decodeSceneObject(
  value: JsonValue,
  meshes: TitleMeshLibrary,
  path: string,
): TitleSceneObject {
  const object = objectAt(value, path);
  const kind = shapeKindAt(object["kind"], `${path}.kind`);

  if (kind === TITLE_SCENE_SHAPE_KIND.Mesh) {
    return decodeMeshSceneObject(object, meshes, path);
  }

  return decodePrimitiveSceneObject(kind, object, path);
}

function decodeMeshSceneObject(
  object: JsonObject,
  meshes: TitleMeshLibrary,
  path: string,
): TitleSceneObject {
  const meshId = meshIdAt(object["mesh"], `${path}.mesh`);
  const mesh = titleSceneObjectMesh(meshId, meshes, path);
  const radius = nonNegativeNumberAt(object["radius"], `${path}.radius`);
  // TODO: Mesh placement needs a real local/world transform pipeline.
  // Mesh scene JSON intentionally has no position field until that exists.
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Mesh,
    ...decodeSceneObjectMetadata(object, path),
    mesh,
    radius,
    footprintRadius:
      optionalNonNegativeNumber(
        object["footprintRadius"],
        `${path}.footprintRadius`,
      ) ?? radius,
    height:
      optionalNonNegativeNumber(object["height"], `${path}.height`) ??
      mesh.height,
    color: colorAt(object["color"], `${path}.color`),
    reflectivity: finiteNumberAt(
      object["reflectivity"],
      `${path}.reflectivity`,
    ),
    ...decodeOpticalMaterial(object, path),
  };
}

function decodePrimitiveSceneObject(
  kind: TitleScenePrimitiveShapeKind,
  object: JsonObject,
  path: string,
): TitleSceneObject {
  const radius = nonNegativeNumberAt(object["radius"], `${path}.radius`);
  return {
    kind,
    ...decodeSceneObjectMetadata(object, path),
    position: vectorAt(object["position"], `${path}.position`),
    radius,
    footprintRadius:
      optionalNonNegativeNumber(
        object["footprintRadius"],
        `${path}.footprintRadius`,
      ) ?? radius,
    height:
      optionalNonNegativeNumber(object["height"], `${path}.height`) ??
      radius * 2,
    color: colorAt(object["color"], `${path}.color`),
    reflectivity: finiteNumberAt(
      object["reflectivity"],
      `${path}.reflectivity`,
    ),
    ...decodeOpticalMaterial(object, path),
  };
}

function decodeSceneObjectMetadata(
  object: JsonObject,
  path: string,
): DecodedSceneObjectMetadata {
  const label = optionalString(object["label"], `${path}.label`);
  return label == null ? {} : { label };
}

function decodeOpticalMaterial(
  object: JsonObject,
  path: string,
): DecodedOpticalMaterial {
  const transparency = optionalRatioNumber(
    object["transparency"],
    `${path}.transparency`,
  );
  const refractiveIndex = optionalRefractiveIndex(
    object["refractiveIndex"],
    `${path}.refractiveIndex`,
  );
  return {
    ...(transparency == null ? {} : { transparency }),
    ...(refractiveIndex == null ? {} : { refractiveIndex }),
  };
}

function titleSceneObjectMesh(
  meshId: TitleMeshId,
  meshes: TitleMeshLibrary,
  path: string,
): TitleMesh {
  if (meshId === TITLE_MESH_ID.Bunny && meshes.bunny != null) {
    return meshes.bunny;
  }
  if (meshId === TITLE_MESH_ID.Dragon && meshes.dragon != null) {
    return meshes.dragon;
  }
  if (meshId === TITLE_MESH_ID.Teapot && meshes.teapot != null) {
    return meshes.teapot;
  }
  throw new SceneLoadError(
    `${path}.mesh references '${meshId}', but that mesh asset is not loaded.`,
  );
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

function optionalRatioNumber(
  value: JsonValue | undefined,
  path: string,
): number | undefined {
  if (value == null) {
    return undefined;
  }
  const number = finiteNumberAt(value, path);
  if (number < MATERIAL_RATIO_MIN || number > MATERIAL_RATIO_MAX) {
    throw new SceneDecodeError(
      `${path} must be between ${MATERIAL_RATIO_MIN} and ${MATERIAL_RATIO_MAX}.`,
    );
  }
  return number;
}

function optionalRefractiveIndex(
  value: JsonValue | undefined,
  path: string,
): number | undefined {
  if (value == null) {
    return undefined;
  }
  const number = finiteNumberAt(value, path);
  if (number < REFRACTIVE_INDEX_MIN) {
    throw new SceneDecodeError(
      `${path} must be at least ${REFRACTIVE_INDEX_MIN}.`,
    );
  }
  return number;
}

function shapeKindAt(
  value: JsonValue | undefined,
  path: string,
): TitleSceneObject["kind"] {
  if (
    value === TITLE_SCENE_SHAPE_KIND.Sphere ||
    value === TITLE_SCENE_SHAPE_KIND.Column ||
    value === TITLE_SCENE_SHAPE_KIND.Cube ||
    value === TITLE_SCENE_SHAPE_KIND.Mesh
  ) {
    return value;
  }
  throw new SceneDecodeError(
    `${path} must be one of '${TITLE_SCENE_SHAPE_KIND.Sphere}', '${TITLE_SCENE_SHAPE_KIND.Column}', ` +
      `'${TITLE_SCENE_SHAPE_KIND.Cube}', or '${TITLE_SCENE_SHAPE_KIND.Mesh}'.`,
  );
}

function meshIdAt(value: JsonValue | undefined, path: string): TitleMeshId {
  if (
    value === TITLE_MESH_ID.Bunny ||
    value === TITLE_MESH_ID.Dragon ||
    value === TITLE_MESH_ID.Teapot
  ) {
    return value;
  }
  throw new SceneDecodeError(
    `${path} must be one of '${TITLE_MESH_ID.Bunny}', '${TITLE_MESH_ID.Dragon}', or '${TITLE_MESH_ID.Teapot}'.`,
  );
}
