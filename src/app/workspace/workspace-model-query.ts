import type { WorkspaceModel } from "./model.js";

export function workspaceHasOpenFile(model: WorkspaceModel): boolean {
  return model.editor != null;
}
