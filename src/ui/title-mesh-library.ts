import {
  createTitleMesh,
  type TitleMesh,
  type TitleMeshPlacement,
  type TitleMeshSource,
} from "./title-mesh.js";

const ZERO_RADIANS = 0;
const RIGHT_ANGLE_RADIANS = Math.PI / 2;
const TITLE_BUNNY_HEIGHT = 2.35;
const TITLE_BUNNY_PITCH_RADIANS = ZERO_RADIANS;
const TITLE_BUNNY_YAW_RADIANS = Math.PI * 0.18;
const TITLE_BUNNY_CENTER_X = -0.85;
const TITLE_BUNNY_FLOOR_Y = 0;
const TITLE_BUNNY_CENTER_Z = -0.15;
const TITLE_TEAPOT_HEIGHT = 2.2;
const TITLE_TEAPOT_PITCH_RADIANS = -RIGHT_ANGLE_RADIANS;
const TITLE_TEAPOT_YAW_RADIANS = -Math.PI * 0.1;
const TITLE_TEAPOT_CENTER_X = 0;
const TITLE_TEAPOT_FLOOR_Y = 0;
const TITLE_TEAPOT_CENTER_Z = 0;
const TITLE_DRAGON_HEIGHT = 2.25;
const TITLE_DRAGON_PITCH_RADIANS = ZERO_RADIANS;
const TITLE_DRAGON_YAW_RADIANS = Math.PI * 0.78;
const TITLE_DRAGON_CENTER_X = 0;
const TITLE_DRAGON_FLOOR_Y = 0;
const TITLE_DRAGON_CENTER_Z = 0;

export const TITLE_MESH_ID = {
  Bunny: "bunny",
  Dragon: "dragon",
  Teapot: "teapot",
} as const;

export type TitleMeshId = (typeof TITLE_MESH_ID)[keyof typeof TITLE_MESH_ID];

export interface TitleMeshLibrary {
  readonly bunny?: TitleMesh;
  readonly dragon?: TitleMesh;
  readonly teapot?: TitleMesh;
}

export function createTitleBunnyMesh(source: TitleMeshSource): TitleMesh {
  return createTitleMesh(source, {
    height: TITLE_BUNNY_HEIGHT,
    pitchRadians: TITLE_BUNNY_PITCH_RADIANS,
    yawRadians: TITLE_BUNNY_YAW_RADIANS,
    centerX: TITLE_BUNNY_CENTER_X,
    floorY: TITLE_BUNNY_FLOOR_Y,
    centerZ: TITLE_BUNNY_CENTER_Z,
  });
}

export function createTitleTeapotMesh(source: TitleMeshSource): TitleMesh {
  return createTitleMesh(source, teapotMeshPlacement());
}

export function createTitleDragonMesh(source: TitleMeshSource): TitleMesh {
  return createTitleMesh(source, dragonMeshPlacement());
}

function teapotMeshPlacement(): TitleMeshPlacement {
  return {
    height: TITLE_TEAPOT_HEIGHT,
    pitchRadians: TITLE_TEAPOT_PITCH_RADIANS,
    yawRadians: TITLE_TEAPOT_YAW_RADIANS,
    centerX: TITLE_TEAPOT_CENTER_X,
    floorY: TITLE_TEAPOT_FLOOR_Y,
    centerZ: TITLE_TEAPOT_CENTER_Z,
  };
}

function dragonMeshPlacement(): TitleMeshPlacement {
  return {
    height: TITLE_DRAGON_HEIGHT,
    pitchRadians: TITLE_DRAGON_PITCH_RADIANS,
    yawRadians: TITLE_DRAGON_YAW_RADIANS,
    centerX: TITLE_DRAGON_CENTER_X,
    floorY: TITLE_DRAGON_FLOOR_Y,
    centerZ: TITLE_DRAGON_CENTER_Z,
  };
}
