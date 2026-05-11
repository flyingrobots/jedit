import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SceneDecodeError, SceneLoadError } from '../domain/errors.js';
import { TITLE_SCENE_FLOOR_KIND, type TitleSceneEnvironment } from '../ui/title-scene-environment.js';
import { TITLE_SCENE_SHAPE_KIND, type TitleScene, type TitleSceneCameraPlacement, type TitleSceneObject, type TitleSceneVector3 } from '../ui/title-scene.js';
import { TITLE_MESH_ID, type TitleMesh, type TitleMeshId, type TitleMeshLibrary } from '../ui/title-mesh.js';
import {
  BUILT_IN_TITLE_SCENE_NAMES,
  type BuiltInTitleSceneName,
  type TitleSceneLoaderPort,
} from '../ports/title-scene-loader.js';

type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
type JsonObject = { readonly [key: string]: JsonValue | undefined };

const DEFAULT_CAMERA_ANGLE = 0;
const DEFAULT_CAMERA_RADIUS = 8.5;
const VECTOR_LENGTH = 3;
const COLOR_CHANNEL_MIN = 0;
const COLOR_CHANNEL_MAX = 255;
const BUILT_IN_TITLE_SCENE_SET = new Set<string>(BUILT_IN_TITLE_SCENE_NAMES);

export async function loadTitleSceneFromFile(path: string, meshes: TitleMeshLibrary): Promise<TitleScene> {
  const content = await fs.readFile(path, 'utf8');
  let json: JsonValue;
  try {
    json = JSON.parse(content) as JsonValue;
  } catch (error) {
    throw new SceneDecodeError(`Scene JSON is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseTitleSceneJson(json, meshes);
}

export async function loadBuiltInTitleScene(name: BuiltInTitleSceneName, meshes: TitleMeshLibrary): Promise<TitleScene> {
  if (!BUILT_IN_TITLE_SCENE_SET.has(name)) {
    throw new SceneDecodeError(`Unknown built-in scene '${name}'.`);
  }
  return loadTitleSceneFromFile(fileURLToPath(new URL(`../scenes/${name}`, import.meta.url)), meshes);
}

export function parseTitleSceneJson(json: JsonValue, meshes: TitleMeshLibrary): TitleScene {
  const root = objectAt(json, 'scene');
  const camera = decodeCamera(root['camera']);
  const environment = decodeEnvironment(root['environment']);
  const objects = arrayAt(root['objects'] ?? [], 'scene.objects').map((objectJson, index) => (
    decodeSceneObject(objectJson, meshes, `scene.objects[${index}]`)
  ));

  return { camera, objects, environment };
}

export function createTitleSceneLoaderPort(): TitleSceneLoaderPort {
  return {
    loadTitleSceneFromFile,
    loadBuiltInTitleScene,
  };
}

function decodeCamera(value: JsonValue | undefined): TitleSceneCameraPlacement {
  if (value == null) {
    return { angle: DEFAULT_CAMERA_ANGLE, radius: DEFAULT_CAMERA_RADIUS };
  }
  const camera = objectAt(value, 'scene.camera');
  return {
    angle: optionalFiniteNumber(camera['angle'], 'scene.camera.angle') ?? DEFAULT_CAMERA_ANGLE,
    radius: optionalNonNegativeNumber(camera['radius'], 'scene.camera.radius') ?? DEFAULT_CAMERA_RADIUS,
  };
}

function decodeEnvironment(value: JsonValue | undefined): TitleSceneEnvironment | undefined {
  if (value == null) {
    return undefined;
  }
  const environment = objectAt(value, 'scene.environment');
  return {
    ...(environment['background'] == null ? {} : { background: colorAt(environment['background'], 'scene.environment.background') }),
    ...(environment['floor'] == null ? {} : { floor: decodeFloor(environment['floor']) }),
    ...(environment['light'] == null ? {} : { light: decodeLight(environment['light']) }),
    ...(environment['walls'] == null ? {} : { walls: arrayAt(environment['walls'], 'scene.environment.walls').map((wall, index) => decodeWall(wall, `scene.environment.walls[${index}]`)) }),
  };
}

function decodeFloor(value: JsonValue): NonNullable<TitleSceneEnvironment['floor']> {
  const floor = objectAt(value, 'scene.environment.floor');
  const kind = floorKindAt(floor['kind'], 'scene.environment.floor.kind');
  return {
    kind,
    ...(floor['dark'] == null ? {} : { dark: colorAt(floor['dark'], 'scene.environment.floor.dark') }),
    ...(floor['light'] == null ? {} : { light: colorAt(floor['light'], 'scene.environment.floor.light') }),
    ...(floor['gridScale'] == null ? {} : { gridScale: nonNegativeNumberAt(floor['gridScale'], 'scene.environment.floor.gridScale') }),
    ...(floor['fadeDistance'] == null ? {} : { fadeDistance: nonNegativeNumberAt(floor['fadeDistance'], 'scene.environment.floor.fadeDistance') }),
  };
}

function decodeLight(value: JsonValue): NonNullable<TitleSceneEnvironment['light']> {
  const light = objectAt(value, 'scene.environment.light');
  return {
    ...(light['direction'] == null ? {} : { direction: vectorAt(light['direction'], 'scene.environment.light.direction') }),
    ...(light['ambient'] == null ? {} : { ambient: finiteNumberAt(light['ambient'], 'scene.environment.light.ambient') }),
    ...(light['diffuse'] == null ? {} : { diffuse: finiteNumberAt(light['diffuse'], 'scene.environment.light.diffuse') }),
    ...(light['specularStrength'] == null ? {} : { specularStrength: finiteNumberAt(light['specularStrength'], 'scene.environment.light.specularStrength') }),
    ...(light['rimStrength'] == null ? {} : { rimStrength: finiteNumberAt(light['rimStrength'], 'scene.environment.light.rimStrength') }),
  };
}

function decodeWall(value: JsonValue, path: string): NonNullable<TitleSceneEnvironment['walls']>[number] {
  const wall = objectAt(value, path);
  const normal = vectorAt(wall['normal'], `${path}.normal`);
  if (vectorLength(normal) === 0) {
    throw new SceneDecodeError(`${path}.normal must be non-zero.`);
  }
  return {
    normal,
    offset: finiteNumberAt(wall['offset'], `${path}.offset`),
    color: colorAt(wall['color'], `${path}.color`),
  };
}

function decodeSceneObject(value: JsonValue, meshes: TitleMeshLibrary, path: string): TitleSceneObject {
  const object = objectAt(value, path);
  const kind = shapeKindAt(object['kind'], `${path}.kind`);

  if (kind === TITLE_SCENE_SHAPE_KIND.Mesh) {
    const meshId = meshIdAt(object['mesh'], `${path}.mesh`);
    const mesh = titleSceneObjectMesh(meshId, meshes, path);
    // TODO: Mesh placement needs a real local/world transform pipeline.
    // Mesh scene JSON intentionally has no position field until that exists.
    return {
      kind: TITLE_SCENE_SHAPE_KIND.Mesh,
      mesh,
      radius: nonNegativeNumberAt(object['radius'], `${path}.radius`),
      footprintRadius: optionalNonNegativeNumber(object['footprintRadius'], `${path}.footprintRadius`) ?? nonNegativeNumberAt(object['radius'], `${path}.radius`),
      height: optionalNonNegativeNumber(object['height'], `${path}.height`) ?? mesh.height,
      color: colorAt(object['color'], `${path}.color`),
      reflectivity: finiteNumberAt(object['reflectivity'], `${path}.reflectivity`),
    };
  }

  const radius = nonNegativeNumberAt(object['radius'], `${path}.radius`);
  return {
    kind,
    position: vectorAt(object['position'], `${path}.position`),
    radius,
    footprintRadius: optionalNonNegativeNumber(object['footprintRadius'], `${path}.footprintRadius`) ?? radius,
    height: optionalNonNegativeNumber(object['height'], `${path}.height`) ?? radius * 2,
    color: colorAt(object['color'], `${path}.color`),
    reflectivity: finiteNumberAt(object['reflectivity'], `${path}.reflectivity`),
  };
}

function titleSceneObjectMesh(meshId: TitleMeshId, meshes: TitleMeshLibrary, path: string): TitleMesh {
  if (meshId === TITLE_MESH_ID.Bunny && meshes.bunny != null) {
    return meshes.bunny;
  }
  if (meshId === TITLE_MESH_ID.Teapot && meshes.teapot != null) {
    return meshes.teapot;
  }
  throw new SceneLoadError(`${path}.mesh references '${meshId}', but that mesh asset is not loaded.`);
}

function objectAt(value: JsonValue | undefined, path: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new SceneDecodeError(`${path} must be an object.`);
  }
  return value;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function arrayAt(value: JsonValue | undefined, path: string): readonly JsonValue[] {
  if (!Array.isArray(value)) {
    throw new SceneDecodeError(`${path} must be an array.`);
  }
  return value;
}

function finiteNumberAt(value: JsonValue | undefined, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SceneDecodeError(`${path} must be a finite number.`);
  }
  return value;
}

function optionalFiniteNumber(value: JsonValue | undefined, path: string): number | undefined {
  return value == null ? undefined : finiteNumberAt(value, path);
}

function nonNegativeNumberAt(value: JsonValue | undefined, path: string): number {
  const number = finiteNumberAt(value, path);
  if (number < 0) {
    throw new SceneDecodeError(`${path} must be non-negative.`);
  }
  return number;
}

function optionalNonNegativeNumber(value: JsonValue | undefined, path: string): number | undefined {
  return value == null ? undefined : nonNegativeNumberAt(value, path);
}

function vectorAt(value: JsonValue | undefined, path: string): TitleSceneVector3 {
  const vector = arrayAt(value, path);
  if (vector.length !== VECTOR_LENGTH) {
    throw new SceneDecodeError(`${path} must contain exactly ${VECTOR_LENGTH} finite numbers.`);
  }
  return [
    finiteNumberAt(vector[0], `${path}[0]`),
    finiteNumberAt(vector[1], `${path}[1]`),
    finiteNumberAt(vector[2], `${path}[2]`),
  ];
}

function colorAt(value: JsonValue | undefined, path: string): readonly [number, number, number] {
  const color = vectorAt(value, path);
  for (let index = 0; index < color.length; index += 1) {
    const channel = color[index]!;
    if (channel < COLOR_CHANNEL_MIN || channel > COLOR_CHANNEL_MAX) {
      throw new SceneDecodeError(`${path}[${index}] must be between ${COLOR_CHANNEL_MIN} and ${COLOR_CHANNEL_MAX}.`);
    }
  }
  return color;
}

function shapeKindAt(value: JsonValue | undefined, path: string): TitleSceneObject['kind'] {
  if (value === TITLE_SCENE_SHAPE_KIND.Sphere || value === TITLE_SCENE_SHAPE_KIND.Column || value === TITLE_SCENE_SHAPE_KIND.Mesh) {
    return value;
  }
  throw new SceneDecodeError(`${path} must be one of '${TITLE_SCENE_SHAPE_KIND.Sphere}', '${TITLE_SCENE_SHAPE_KIND.Column}', or '${TITLE_SCENE_SHAPE_KIND.Mesh}'.`);
}

function meshIdAt(value: JsonValue | undefined, path: string): TitleMeshId {
  if (value === TITLE_MESH_ID.Bunny || value === TITLE_MESH_ID.Teapot) {
    return value;
  }
  throw new SceneDecodeError(`${path} must be one of '${TITLE_MESH_ID.Bunny}' or '${TITLE_MESH_ID.Teapot}'.`);
}

function floorKindAt(value: JsonValue | undefined, path: string): NonNullable<TitleSceneEnvironment['floor']>['kind'] {
  if (value === TITLE_SCENE_FLOOR_KIND.Grid || value === TITLE_SCENE_FLOOR_KIND.Solid || value === TITLE_SCENE_FLOOR_KIND.None) {
    return value;
  }
  throw new SceneDecodeError(`${path} must be one of '${TITLE_SCENE_FLOOR_KIND.Grid}', '${TITLE_SCENE_FLOOR_KIND.Solid}', or '${TITLE_SCENE_FLOOR_KIND.None}'.`);
}

function vectorLength(vector: TitleSceneVector3): number {
  return Math.sqrt((vector[0] * vector[0]) + (vector[1] * vector[1]) + (vector[2] * vector[2]));
}
