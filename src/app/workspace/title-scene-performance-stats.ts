import { resolveWorkspaceLayout } from "../../ui/drawer-layout.js";
import {
  TITLE_SCENE_SHAPE_KIND,
  generateTitleScene,
} from "../../ui/title-scene.js";
import type { TitleScene, TitleSceneObject } from "../../ui/title-scene.js";
import { titleSceneMaterialColors } from "../../ui/title-screen.js";
import { TITLE_RENDER_MODE } from "../../ui/title-screen.js";
import { ASCII_SAMPLE_COUNT } from "../../ui/averaging-ascii-canvas.js";
import { BRAILLE_SAMPLE_COUNT } from "../../ui/averaging-braille-canvas.js";
import type { WorkspaceModel } from "./model.js";
import { workspaceBodyHeight } from "./viewport.js";

const GENERATED_SCENE_PREFIX = "generated";
const SCENE_SEED_PRECISION = 3;

export interface TitleScenePerformanceStats {
  readonly sceneName: string;
  readonly objectCount: number;
  readonly triangleCount: number;
  readonly rayCount: number;
}

interface TitleRenderDimensions {
  readonly width: number;
  readonly height: number;
}

export function titleScenePerformanceStats(
  model: WorkspaceModel,
): TitleScenePerformanceStats | undefined {
  if (model.editor != null) {
    return undefined;
  }
  const scene = titleSceneForModel(model);
  const dimensions = titleRenderDimensions(model);
  return {
    sceneName: titleSceneName(model),
    objectCount: scene.objects.length,
    triangleCount: titleSceneTriangleCount(scene),
    rayCount: titleSceneRayCount(dimensions, model.titleRenderMode),
  };
}

function titleSceneForModel(model: WorkspaceModel): TitleScene {
  return (
    model.sceneOverride ??
    generateTitleScene(
      model.titleSceneSeed,
      titleSceneMaterialColors(model.jeditTheme),
      model.titleMeshes.bunny,
    )
  );
}

function titleSceneName(model: WorkspaceModel): string {
  return (
    model.titleSceneName ??
    `${GENERATED_SCENE_PREFIX}:${model.titleSceneSeed.toFixed(SCENE_SEED_PRECISION)}`
  );
}

function titleRenderDimensions(model: WorkspaceModel): TitleRenderDimensions {
  const bodyHeight = workspaceBodyHeight({
    rows: model.rows,
    footerVisible: model.footerVisible,
  });
  const layout = resolveWorkspaceLayout(
    model.columns,
    model.fileDrawerProgress,
    model.graftDrawerProgress,
    model.historyDrawerProgress,
  );
  return {
    width: layout.viewer.width,
    height: bodyHeight,
  };
}

function titleSceneTriangleCount(scene: TitleScene): number {
  return scene.objects.reduce(
    (total, object) => total + titleSceneObjectTriangleCount(object),
    0,
  );
}

function titleSceneObjectTriangleCount(object: TitleSceneObject): number {
  return object.kind === TITLE_SCENE_SHAPE_KIND.Mesh
    ? object.mesh.triangles.length
    : 0;
}

function titleSceneRayCount(
  dimensions: TitleRenderDimensions,
  renderMode: WorkspaceModel["titleRenderMode"],
): number {
  const samplesPerCell =
    renderMode === TITLE_RENDER_MODE.Ascii
      ? ASCII_SAMPLE_COUNT
      : BRAILLE_SAMPLE_COUNT;
  return dimensions.width * dimensions.height * samplesPerCell;
}
