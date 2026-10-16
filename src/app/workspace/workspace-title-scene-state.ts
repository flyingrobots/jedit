import { createTitleCameraState } from '../title-camera-session.js';
import { TITLE_BACKDROP_KIND } from '../../ui/title-screen.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';

export function applyWorkspaceTitleSceneLoadResult(
  model: WorkspaceModel,
  msg: Extract<
    WorkspaceMsg,
    { type: typeof WorkspaceMessageTypes.LoadSceneResult }
  >,
): WorkspaceModel {
  // A result carrying no scene is a cancellation or a RuntimeIssue, not a
  // backdrop change. Switching to LegacyScene regardless dropped the static
  // logo for a scene that was never loaded, and because
  // workspaceAnimationIsActive counts LegacyScene as animating, it also put the
  // workspace back into a 60Hz render loop -- the #320 regression, on the
  // failure path.
  if (msg.scene == null) {
    return model;
  }
  return {
    ...model,
    sceneOverride: msg.scene,
    titleSceneName: msg.sceneName,
    titleBackdropKind: TITLE_BACKDROP_KIND.LegacyScene,
    titleCamera: createTitleCameraState(msg.scene.camera),
  };
}
