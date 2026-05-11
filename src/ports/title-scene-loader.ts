import type { TitleScene } from '../ui/title-scene.js';
import type { TitleMeshLibrary } from '../ui/title-mesh.js';

/**
 * Authoritative registry of product-visible built-in title scenes.
 *
 * Adding a `.jedit-scene` file to `scenes/` is not sufficient to expose it;
 * register it here as well. This order controls the scene picker display order.
 */
export const BUILT_IN_TITLE_SCENE_NAMES = [
  'teapot-cornell.jedit-scene',
  'teapot-gallery.jedit-scene',
  'bunny.jedit-scene',
  'neon-orbit.jedit-scene',
  'mirror-hall.jedit-scene',
  'eclipse-gate.jedit-scene',
  'prism-garden.jedit-scene',
  'aurora-vault.jedit-scene',
  'ember-court.jedit-scene',
  'sphere.jedit-scene',
  'column.jedit-scene',
  'sphere-ground.jedit-scene',
] as const;

export type BuiltInTitleSceneName = typeof BUILT_IN_TITLE_SCENE_NAMES[number];

export interface TitleSceneLoaderPort {
  loadTitleSceneFromFile(path: string, meshes: TitleMeshLibrary): Promise<TitleScene>;
  loadBuiltInTitleScene(name: BuiltInTitleSceneName, meshes: TitleMeshLibrary): Promise<TitleScene>;
}
