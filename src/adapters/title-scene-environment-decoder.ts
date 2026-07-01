import { SceneDecodeError } from "../domain/errors.js";
import {
  TITLE_SCENE_FLOOR_KIND,
  type TitleSceneEnvironment,
} from "../ui/title-scene-environment.js";
import type { TitleSceneVector3 } from "../ui/title-scene.js";
import {
  arrayAt,
  colorAt,
  finiteNumberAt,
  nonNegativeNumberAt,
  objectAt,
  vectorAt,
  type JsonObject,
  type JsonValue,
} from "./title-scene-json-decoder.js";

type SceneFloor = NonNullable<TitleSceneEnvironment["floor"]>;
type SceneLight = NonNullable<TitleSceneEnvironment["light"]>;
type SceneWall = NonNullable<TitleSceneEnvironment["walls"]>[number];

export function decodeTitleSceneEnvironment(
  value: JsonValue | undefined,
): TitleSceneEnvironment | undefined {
  if (value == null) {
    return undefined;
  }
  const environment = objectAt(value, "scene.environment");
  return {
    ...decodeBackground(environment),
    ...decodeFloorField(environment),
    ...decodeLightField(environment),
    ...decodeWallsField(environment),
  };
}

function decodeBackground(
  environment: JsonObject,
): Pick<TitleSceneEnvironment, "background"> {
  return environment["background"] == null
    ? {}
    : {
        background: colorAt(
          environment["background"],
          "scene.environment.background",
        ),
      };
}

function decodeFloorField(
  environment: JsonObject,
): Pick<TitleSceneEnvironment, "floor"> {
  return environment["floor"] == null
    ? {}
    : { floor: decodeFloor(environment["floor"]) };
}

function decodeLightField(
  environment: JsonObject,
): Pick<TitleSceneEnvironment, "light"> {
  return environment["light"] == null
    ? {}
    : { light: decodeLight(environment["light"]) };
}

function decodeWallsField(
  environment: JsonObject,
): Pick<TitleSceneEnvironment, "walls"> {
  return environment["walls"] == null
    ? {}
    : {
        walls: arrayAt(environment["walls"], "scene.environment.walls").map(
          (wall, index) =>
            decodeWall(wall, `scene.environment.walls[${index}]`),
        ),
      };
}

function decodeFloor(value: JsonValue): SceneFloor {
  const floor = objectAt(value, "scene.environment.floor");
  const kind = floorKindAt(floor["kind"], "scene.environment.floor.kind");
  return {
    kind,
    ...decodeFloorDark(floor),
    ...decodeFloorLight(floor),
    ...decodeFloorGridScale(floor),
    ...decodeFloorFadeDistance(floor),
  };
}

function decodeFloorDark(floor: JsonObject): Pick<SceneFloor, "dark"> {
  return floor["dark"] == null
    ? {}
    : { dark: colorAt(floor["dark"], "scene.environment.floor.dark") };
}

function decodeFloorLight(floor: JsonObject): Pick<SceneFloor, "light"> {
  return floor["light"] == null
    ? {}
    : { light: colorAt(floor["light"], "scene.environment.floor.light") };
}

function decodeFloorGridScale(
  floor: JsonObject,
): Pick<SceneFloor, "gridScale"> {
  return floor["gridScale"] == null
    ? {}
    : {
        gridScale: nonNegativeNumberAt(
          floor["gridScale"],
          "scene.environment.floor.gridScale",
        ),
      };
}

function decodeFloorFadeDistance(
  floor: JsonObject,
): Pick<SceneFloor, "fadeDistance"> {
  return floor["fadeDistance"] == null
    ? {}
    : {
        fadeDistance: nonNegativeNumberAt(
          floor["fadeDistance"],
          "scene.environment.floor.fadeDistance",
        ),
      };
}

function decodeLight(value: JsonValue): SceneLight {
  const light = objectAt(value, "scene.environment.light");
  return {
    ...decodeLightDirection(light),
    ...decodeLightOrbit(light),
    ...decodeLightAmbient(light),
    ...decodeLightDiffuse(light),
    ...decodeLightSpecular(light),
    ...decodeLightRim(light),
  };
}

function decodeLightDirection(
  light: JsonObject,
): Pick<SceneLight, "direction"> {
  return light["direction"] == null
    ? {}
    : {
        direction: vectorAt(
          light["direction"],
          "scene.environment.light.direction",
        ),
      };
}

function decodeLightOrbit(light: JsonObject): Pick<SceneLight, "orbit"> {
  return light["orbit"] == null
    ? {}
    : { orbit: decodeLightOrbitObject(light["orbit"]) };
}

function decodeLightOrbitObject(value: JsonValue): SceneLight["orbit"] {
  const orbit = objectAt(value, "scene.environment.light.orbit");
  const radius = nonNegativeNumberAt(
    orbit["radius"],
    "scene.environment.light.orbit.radius",
  );
  const height = finiteNumberAt(
    orbit["height"],
    "scene.environment.light.orbit.height",
  );
  if (radius === 0 && height === 0) {
    throw new SceneDecodeError(
      "scene.environment.light.orbit must produce a non-zero light direction.",
    );
  }
  return {
    radius,
    height,
    phase: finiteNumberAt(
      orbit["phase"],
      "scene.environment.light.orbit.phase",
    ),
    angularSpeed: finiteNumberAt(
      orbit["angularSpeed"],
      "scene.environment.light.orbit.angularSpeed",
    ),
  };
}

function decodeLightAmbient(light: JsonObject): Pick<SceneLight, "ambient"> {
  return light["ambient"] == null
    ? {}
    : {
        ambient: finiteNumberAt(
          light["ambient"],
          "scene.environment.light.ambient",
        ),
      };
}

function decodeLightDiffuse(light: JsonObject): Pick<SceneLight, "diffuse"> {
  return light["diffuse"] == null
    ? {}
    : {
        diffuse: finiteNumberAt(
          light["diffuse"],
          "scene.environment.light.diffuse",
        ),
      };
}

function decodeLightSpecular(
  light: JsonObject,
): Pick<SceneLight, "specularStrength"> {
  return light["specularStrength"] == null
    ? {}
    : {
        specularStrength: finiteNumberAt(
          light["specularStrength"],
          "scene.environment.light.specularStrength",
        ),
      };
}

function decodeLightRim(light: JsonObject): Pick<SceneLight, "rimStrength"> {
  return light["rimStrength"] == null
    ? {}
    : {
        rimStrength: finiteNumberAt(
          light["rimStrength"],
          "scene.environment.light.rimStrength",
        ),
      };
}

function decodeWall(value: JsonValue, path: string): SceneWall {
  const wall = objectAt(value, path);
  const normal = vectorAt(wall["normal"], `${path}.normal`);
  if (vectorLength(normal) === 0) {
    throw new SceneDecodeError(`${path}.normal must be non-zero.`);
  }
  return {
    normal,
    offset: finiteNumberAt(wall["offset"], `${path}.offset`),
    color: colorAt(wall["color"], `${path}.color`),
  };
}

function floorKindAt(
  value: JsonValue | undefined,
  path: string,
): SceneFloor["kind"] {
  if (
    value === TITLE_SCENE_FLOOR_KIND.Grid ||
    value === TITLE_SCENE_FLOOR_KIND.Solid ||
    value === TITLE_SCENE_FLOOR_KIND.None
  ) {
    return value;
  }
  throw new SceneDecodeError(
    `${path} must be one of '${TITLE_SCENE_FLOOR_KIND.Grid}', '${TITLE_SCENE_FLOOR_KIND.Solid}', or '${TITLE_SCENE_FLOOR_KIND.None}'.`,
  );
}

function vectorLength(vector: TitleSceneVector3): number {
  return Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2],
  );
}
