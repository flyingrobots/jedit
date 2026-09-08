import type { Cmd, KeyMsg } from "@flyingrobots/bijou-tui";
import { JEDIT_SCENE_PICKER_TOGGLE_KEY } from "../keybindings.js";
import type { WorkspaceModel } from "./model.js";
import { WorkspaceMessageTypes, type WorkspaceMsg } from "./msg.js";
import {
  RuntimeIssueLevels,
  RuntimeIssueSources,
  WorkspaceRuntimeIssueNames,
  WorkspaceRuntimeIssueTypes,
} from "./runtime-issue.js";
import {
  isWorkspaceScenePickerAcceptKey,
  isWorkspaceScenePickerCloseKey,
  isWorkspaceScenePickerNextKey,
  isWorkspaceScenePickerPreviousKey,
} from "./workspace-key.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import { TITLE_BACKDROP_KIND } from "../../ui/title-screen.js";

const SCENE_PICKER_MIN_INDEX = 0;
const SCENE_PICKER_STEP = 1;
const UNKNOWN_SCENE_LOAD_FAILURE = "Unable to describe scene load failure";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateScenePickerKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (
    model.editor == null &&
    msg.ctrl &&
    !msg.alt &&
    msg.key === JEDIT_SCENE_PICKER_TOGGLE_KEY
  ) {
    return [
      {
        ...model,
        scenePickerOpen: !model.scenePickerOpen,
        titleBackdropKind: TITLE_BACKDROP_KIND.LegacyScene,
      },
      [],
    ];
  }

  if (!model.scenePickerOpen) {
    return undefined;
  }

  return updateOpenScenePickerKey(msg, model, context);
}

function updateOpenScenePickerKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (isWorkspaceScenePickerCloseKey(msg)) {
    return [{ ...model, scenePickerOpen: false }, []];
  }
  if (isWorkspaceScenePickerPreviousKey(msg)) {
    return [{ ...model, scenePickerFocusIndex: previousSceneIndex(model) }, []];
  }
  if (isWorkspaceScenePickerNextKey(msg)) {
    return [{ ...model, scenePickerFocusIndex: nextSceneIndex(model) }, []];
  }
  if (!isWorkspaceScenePickerAcceptKey(msg)) {
    return [model, []];
  }
  return acceptScenePickerSelection(model, context);
}

function previousSceneIndex(model: WorkspaceModel): number {
  return Math.max(
    SCENE_PICKER_MIN_INDEX,
    model.scenePickerFocusIndex - SCENE_PICKER_STEP,
  );
}

function nextSceneIndex(model: WorkspaceModel): number {
  const maxIndex = Math.max(
    SCENE_PICKER_MIN_INDEX,
    model.availableScenes.length - SCENE_PICKER_STEP,
  );
  return Math.min(maxIndex, model.scenePickerFocusIndex + SCENE_PICKER_STEP);
}

function acceptScenePickerSelection(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const selected = model.availableScenes[model.scenePickerFocusIndex];
  if (selected == null) {
    return [model, []];
  }

  return [
    { ...model, scenePickerOpen: false },
    [
      async () => {
        try {
          const scene =
            await context.deps.titleSceneLoader.loadBuiltInTitleScene(
              selected,
              model.titleMeshes,
            );
          return {
            type: WorkspaceMessageTypes.LoadSceneResult,
            scene,
            sceneName: selected,
          };
        } catch (error) {
          const issue =
            error instanceof Error
              ? describeSceneLoadError(error, context.nowMs())
              : describeSceneLoadFailure(String(error), context.nowMs());
          return { type: WorkspaceMessageTypes.RuntimeIssue, issue };
        }
      },
    ],
  ];
}

function describeSceneLoadError(error: Error, atMs: number) {
  return {
    type: WorkspaceRuntimeIssueTypes.System,
    name: WorkspaceRuntimeIssueNames.SceneLoadError,
    message: error.message,
    level: RuntimeIssueLevels.Error,
    source: RuntimeIssueSources.Command,
    atMs,
    ...(error.stack != null ? { stack: error.stack } : {}),
  };
}

function describeSceneLoadFailure(
  encodedError: string | undefined,
  atMs: number,
) {
  return {
    type: WorkspaceRuntimeIssueTypes.System,
    name: WorkspaceRuntimeIssueNames.SceneLoadError,
    message: encodedError ?? UNKNOWN_SCENE_LOAD_FAILURE,
    level: RuntimeIssueLevels.Error,
    source: RuntimeIssueSources.Command,
    atMs,
  };
}
