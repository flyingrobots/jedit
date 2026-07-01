import { SceneDecodeError, SceneLoadError } from "../domain/errors.js";
import {
  TITLE_SCENE_SHAPE_KIND,
  type TitleSceneMeshObject,
  type TitleSceneObject,
  type TitleScenePrimitiveShapeKind,
} from "../ui/title-scene.js";
import type { TitleMesh } from "../ui/title-mesh.js";
import {
  TITLE_MESH_ID,
  type TitleMeshId,
  type TitleMeshLibrary,
} from "../ui/title-mesh-library.js";
import {
  colorAt,
  finiteNumberAt,
  nonNegativeNumberAt,
  objectAt,
  optionalNonNegativeNumber,
  optionalString,
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
  readonly localYaw?: TitleSceneObject["localYaw"];
}

const MATERIAL_RATIO_MIN = 0;
const MATERIAL_RATIO_MAX = 1;
const REFRACTIVE_INDEX_MIN = 1;

export function decodeSceneObject(
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
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Mesh,
    ...decodeSceneObjectMetadata(object, path),
    mesh,
    ...decodeMeshOffset(object, path),
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
  return {
    ...(label == null ? {} : { label }),
    ...decodeLocalYaw(object, path),
  };
}

function decodeMeshOffset(
  object: JsonObject,
  path: string,
): Pick<TitleSceneMeshObject, "offset"> {
  return object["offset"] == null
    ? {}
    : { offset: vectorAt(object["offset"], `${path}.offset`) };
}

function decodeLocalYaw(
  object: JsonObject,
  path: string,
): Pick<TitleSceneObject, "localYaw"> {
  if (object["localYaw"] == null) {
    return {};
  }
  const localYaw = objectAt(object["localYaw"], `${path}.localYaw`);
  return {
    localYaw: {
      phase: finiteNumberAt(localYaw["phase"], `${path}.localYaw.phase`),
      angularSpeed: finiteNumberAt(
        localYaw["angularSpeed"],
        `${path}.localYaw.angularSpeed`,
      ),
    },
  };
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
