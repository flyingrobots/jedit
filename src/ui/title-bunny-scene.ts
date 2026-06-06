import type { TitleMesh } from "./title-mesh.js";
import type { TitleSceneCameraPlacement } from "./title-scene-camera.js";
import { TITLE_SCENE_SHAPE_KIND } from "./title-scene-shape-kind.js";
import type {
  TitleSceneColor,
  TitleSceneColorSet,
  TitleSceneLocalYaw,
  TitleSceneMeshObject,
  TitleSceneObject,
  TitleSceneOrbit,
  TitleScenePrimitiveObject,
  TitleSceneVector3,
} from "./title-scene.js";

interface BunnyMeshMaterial {
  readonly color: TitleSceneColor;
  readonly reflectivity: number;
  readonly offset: TitleSceneVector3;
  readonly orbit: TitleSceneOrbit;
  readonly localYaw: TitleSceneLocalYaw;
}

const BUNNY_SCENE_CAMERA_ANGLE = 0.14;
const BUNNY_SCENE_CAMERA_RADIUS = 6.4;
const BUNNY_SCENE_ORBIT_CENTER: TitleSceneVector3 = [0, 0, 0];
const BUNNY_SCENE_ORBIT_RADIUS = 2.35;
const BUNNY_SCENE_ORBIT_SPEED = 0.62;
const BUNNY_SCENE_RABBIT_PHASE = -0.52;
const BUNNY_SCENE_CUBE_PHASE = BUNNY_SCENE_RABBIT_PHASE + Math.PI;
const BUNNY_SCENE_RABBIT_YAW_SPEED = 1.2;
const BUNNY_SCENE_CUBE_YAW_SPEED = -1.6;
const BUNNY_SCENE_RABBIT_YAW_PHASE = 0.22;
const BUNNY_SCENE_CUBE_YAW_PHASE = -0.34;
const BUNNY_SCENE_MESH_REFLECTIVITY = 0.16;
const BUNNY_SCENE_MIRROR_SPHERE_RADIUS = 1.08;
const BUNNY_SCENE_MIRROR_SPHERE_HEIGHT = BUNNY_SCENE_MIRROR_SPHERE_RADIUS * 2;
const BUNNY_SCENE_MIRROR_SPHERE_FOOTPRINT_RADIUS =
  BUNNY_SCENE_MIRROR_SPHERE_RADIUS;
const BUNNY_SCENE_MIRROR_SPHERE_REFLECTIVITY = 1;
const BUNNY_SCENE_MIRROR_SPHERE_POSITION: TitleSceneVector3 = [
  0,
  BUNNY_SCENE_MIRROR_SPHERE_RADIUS,
  0,
];
const BUNNY_SCENE_CUBE_HALF_SIZE = 0.52;
const BUNNY_SCENE_CUBE_HEIGHT = BUNNY_SCENE_CUBE_HALF_SIZE * 2;
const BUNNY_SCENE_CUBE_FOOTPRINT_RADIUS =
  BUNNY_SCENE_CUBE_HALF_SIZE * Math.SQRT2;
const BUNNY_SCENE_CUBE_REFLECTIVITY = 0.22;
const BUNNY_SCENE_CUBE_POSITION: TitleSceneVector3 = [
  0,
  BUNNY_SCENE_CUBE_HALF_SIZE,
  0,
];

export function titleBunnySceneCameraPlacement(): TitleSceneCameraPlacement {
  return {
    angle: BUNNY_SCENE_CAMERA_ANGLE,
    radius: BUNNY_SCENE_CAMERA_RADIUS,
  };
}

export function createBunnySceneObjects(
  colors: TitleSceneColorSet,
  mesh: TitleMesh,
): readonly TitleSceneObject[] {
  return [
    createMirrorSphere(colors),
    createBunnyMeshObject(mesh, {
      color: colors.accent,
      reflectivity: BUNNY_SCENE_MESH_REFLECTIVITY,
      offset: centeredBunnyMeshOffset(mesh),
      orbit: bunnySceneOrbit(BUNNY_SCENE_RABBIT_PHASE),
      localYaw: bunnySceneLocalYaw(
        BUNNY_SCENE_RABBIT_YAW_PHASE,
        BUNNY_SCENE_RABBIT_YAW_SPEED,
      ),
    }),
    createOrbitingCube(colors),
  ];
}

function createBunnyMeshObject(
  mesh: TitleMesh,
  material: BunnyMeshMaterial,
): TitleSceneMeshObject {
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Mesh,
    mesh,
    offset: material.offset,
    radius: mesh.footprintRadius,
    footprintRadius: mesh.footprintRadius,
    height: mesh.height,
    color: material.color,
    reflectivity: material.reflectivity,
    orbit: material.orbit,
    localYaw: material.localYaw,
  };
}

function createMirrorSphere(
  colors: TitleSceneColorSet,
): TitleScenePrimitiveObject {
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Sphere,
    position: BUNNY_SCENE_MIRROR_SPHERE_POSITION,
    radius: BUNNY_SCENE_MIRROR_SPHERE_RADIUS,
    footprintRadius: BUNNY_SCENE_MIRROR_SPHERE_FOOTPRINT_RADIUS,
    height: BUNNY_SCENE_MIRROR_SPHERE_HEIGHT,
    color: colors.ink,
    reflectivity: BUNNY_SCENE_MIRROR_SPHERE_REFLECTIVITY,
  };
}

function createOrbitingCube(
  colors: TitleSceneColorSet,
): TitleScenePrimitiveObject {
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Cube,
    position: BUNNY_SCENE_CUBE_POSITION,
    radius: BUNNY_SCENE_CUBE_HALF_SIZE,
    footprintRadius: BUNNY_SCENE_CUBE_FOOTPRINT_RADIUS,
    height: BUNNY_SCENE_CUBE_HEIGHT,
    color: colors.success,
    reflectivity: BUNNY_SCENE_CUBE_REFLECTIVITY,
    orbit: bunnySceneOrbit(BUNNY_SCENE_CUBE_PHASE),
    localYaw: bunnySceneLocalYaw(
      BUNNY_SCENE_CUBE_YAW_PHASE,
      BUNNY_SCENE_CUBE_YAW_SPEED,
    ),
  };
}

function bunnySceneOrbit(phase: number): TitleSceneOrbit {
  return {
    center: BUNNY_SCENE_ORBIT_CENTER,
    radius: BUNNY_SCENE_ORBIT_RADIUS,
    phase,
    angularSpeed: BUNNY_SCENE_ORBIT_SPEED,
  };
}

function bunnySceneLocalYaw(
  phase: number,
  angularSpeed: number,
): TitleSceneLocalYaw {
  return {
    phase,
    angularSpeed,
  };
}

function centeredBunnyMeshOffset(mesh: TitleMesh): TitleSceneVector3 {
  return [
    -((mesh.bounds.min[0] + mesh.bounds.max[0]) / 2),
    0,
    -((mesh.bounds.min[2] + mesh.bounds.max[2]) / 2),
  ];
}
