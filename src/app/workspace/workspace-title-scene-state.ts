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
  return {
    ...model,
    sceneOverride: msg.scene,
    titleSceneName: msg.scene == null ? undefined : msg.sceneName,
    titleBackdropKind: TITLE_BACKDROP_KIND.LegacyScene,
    titleCamera:
      msg.scene == null
        ? model.titleCamera
        : createTitleCameraState(msg.scene.camera),
  };
}
