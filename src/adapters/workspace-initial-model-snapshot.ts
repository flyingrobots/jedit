import { BijouI18nAdapter } from "./bijou-i18n-adapter.js";
import type { WorkspaceInitialModelSnapshot } from "../app/workspace/init.js";
import type { TitleMeshLibrary } from "../ui/title-mesh-library.js";
import {
  JEDIT_THEME_ENV,
  resolveInitialJeditTheme,
} from "../ui/jedit-themes.js";
import { loadEntries } from "./filesystem.js";

// Startup loads no title geometry. The ray-traced title subsystem parses
// ~1.75 MB of OBJ text (teapot, dragon, bunny) and that cost belonged to a
// title screen jedit no longer shows on launch. The meshes and scenes remain
// in the tree and load on demand for anything that opts into the legacy
// backdrop; nothing on the startup path pays for them.
const NO_STARTUP_TITLE_MESHES: TitleMeshLibrary = Object.freeze({});

export function createInitialModelSnapshot(
  nowMs: number,
  cwd: string,
  random: () => number,
): WorkspaceInitialModelSnapshot {
  return {
    entries: loadEntries(cwd),
    titleMeshes: NO_STARTUP_TITLE_MESHES,
    titleSceneSeed: random(),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter(),
    nowMs,
  };
}
