import { BijouI18nAdapter } from "./bijou-i18n-adapter.js";
import type { WorkspaceInitialModelSnapshot } from "../app/workspace/init.js";
import {
  DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
  type BuiltInTitleSceneName,
} from "../ports/title-scene-loader.js";
import type { TitleScene } from "../ui/title-scene.js";
import type { TitleMeshLibrary } from "../ui/title-mesh-library.js";
import {
  JEDIT_THEME_ENV,
  resolveInitialJeditTheme,
} from "../ui/jedit-themes.js";
import { loadEntries } from "./filesystem.js";
import { loadBuiltInTitleSceneSync } from "./title-scene-loader.js";
import { loadStartupTitleMeshes } from "./workspace-title-meshes.js";

const DEFAULT_TITLE_SCENE_WARNING_PREFIX =
  "jedit default title scene unavailable";

interface StartupTitleScene {
  readonly name: BuiltInTitleSceneName;
  readonly scene: TitleScene;
}

export function createInitialModelSnapshot(
  nowMs: number,
  cwd: string,
  random: () => number,
): WorkspaceInitialModelSnapshot {
  const titleMeshes = loadStartupTitleMeshes();
  const startupTitleScene = loadStartupTitleScene(titleMeshes);
  return {
    entries: loadEntries(cwd),
    titleMeshes,
    ...(startupTitleScene == null
      ? {}
      : {
          sceneOverride: startupTitleScene.scene,
          sceneOverrideName: startupTitleScene.name,
        }),
    titleSceneSeed: random(),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter(),
    nowMs,
  };
}

function loadStartupTitleScene(
  titleMeshes: TitleMeshLibrary,
): StartupTitleScene | undefined {
  try {
    return {
      name: DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
      scene: loadBuiltInTitleSceneSync(
        DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
        titleMeshes,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${DEFAULT_TITLE_SCENE_WARNING_PREFIX}: ${message}\n`);
    return undefined;
  }
}
