import {
  TITLE_SCENE_SHAPE_KIND,
  type TitleScene,
  type TitleSceneColor,
  type TitleSceneMeshObject,
  type TitleSceneObject,
} from "../../ui/title-scene.js";

export interface TitleDragonMaterialPreset {
  readonly name: string;
  readonly color: TitleSceneColor;
  readonly reflectivity: number;
  readonly transparency: number;
  readonly refractiveIndex: number;
}

const TITLE_DRAGON_OBJECT_LABEL = "stanford-dragon";
const FIRST_TITLE_DRAGON_MATERIAL_INDEX = 0;
const NEXT_TITLE_DRAGON_MATERIAL_STEP = 1;
const DEFAULT_TITLE_DRAGON_MATERIAL_PRESET = {
  name: "Prismatic Ice",
  color: [194, 236, 255],
  reflectivity: 0.24,
  transparency: 0.62,
  refractiveIndex: 1.65,
} satisfies TitleDragonMaterialPreset;

export const TITLE_DRAGON_MATERIAL_PRESETS = [
  DEFAULT_TITLE_DRAGON_MATERIAL_PRESET,
  {
    name: "Chrome Mirror",
    color: [230, 236, 244],
    reflectivity: 0.98,
    transparency: 0,
    refractiveIndex: 1,
  },
  {
    name: "Emerald Glass",
    color: [92, 255, 178],
    reflectivity: 0.32,
    transparency: 0.58,
    refractiveIndex: 1.52,
  },
  {
    name: "Ruby Resin",
    color: [255, 92, 128],
    reflectivity: 0.18,
    transparency: 0.34,
    refractiveIndex: 1.47,
  },
  {
    name: "Obsidian",
    color: [44, 40, 58],
    reflectivity: 0.72,
    transparency: 0.04,
    refractiveIndex: 1.3,
  },
  {
    name: "Cyan Hologlass",
    color: [80, 246, 255],
    reflectivity: 0.42,
    transparency: 0.72,
    refractiveIndex: 1.82,
  },
] satisfies readonly TitleDragonMaterialPreset[];

export function titleDragonMaterialPresetAt(
  index: number,
): TitleDragonMaterialPreset {
  return (
    TITLE_DRAGON_MATERIAL_PRESETS[titleDragonMaterialIndex(index)] ??
    DEFAULT_TITLE_DRAGON_MATERIAL_PRESET
  );
}

export function nextTitleDragonMaterialIndex(index: number): number {
  return titleDragonMaterialIndex(index + NEXT_TITLE_DRAGON_MATERIAL_STEP);
}

export function applyTitleDragonMaterial(
  scene: TitleScene,
  preset: TitleDragonMaterialPreset,
): TitleScene {
  return {
    ...scene,
    objects: scene.objects.map((object) =>
      isTitleDragonObject(object)
        ? titleDragonObjectWithMaterial(object, preset)
        : object,
    ),
  };
}

function titleDragonMaterialIndex(index: number): number {
  const count = TITLE_DRAGON_MATERIAL_PRESETS.length;
  if (!Number.isFinite(index) || count === 0) {
    return FIRST_TITLE_DRAGON_MATERIAL_INDEX;
  }
  return ((Math.trunc(index) % count) + count) % count;
}

function isTitleDragonObject(
  object: TitleSceneObject,
): object is TitleSceneMeshObject {
  return (
    object.kind === TITLE_SCENE_SHAPE_KIND.Mesh &&
    object.label === TITLE_DRAGON_OBJECT_LABEL
  );
}

function titleDragonObjectWithMaterial(
  object: TitleSceneMeshObject,
  preset: TitleDragonMaterialPreset,
): TitleSceneMeshObject {
  return {
    ...object,
    color: preset.color,
    reflectivity: preset.reflectivity,
    transparency: preset.transparency,
    refractiveIndex: preset.refractiveIndex,
  };
}
