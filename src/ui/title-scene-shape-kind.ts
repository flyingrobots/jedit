export const TITLE_SCENE_SHAPE_KIND = {
  Sphere: 'sphere',
  Column: 'column',
  Cube: 'cube',
  Mesh: 'mesh',
} as const;

export type TitleSceneShapeKind = typeof TITLE_SCENE_SHAPE_KIND[keyof typeof TITLE_SCENE_SHAPE_KIND];
export type TitleScenePrimitiveShapeKind =
  | typeof TITLE_SCENE_SHAPE_KIND.Sphere
  | typeof TITLE_SCENE_SHAPE_KIND.Column
  | typeof TITLE_SCENE_SHAPE_KIND.Cube;
