import { discoverGitRoot } from './footer-filepaths.js';
import { BijouI18nAdapter } from "./bijou-i18n-adapter.js";
import type { WorkspaceInitialModelSnapshot } from "../app/workspace/init.js";
import {
  JEDIT_THEME_ENV,
  resolveInitialJeditTheme,
} from "../ui/jedit-themes.js";
import { loadEntries, portableFileSearchPath } from "./filesystem.js";

export function createInitialModelSnapshot(
  nowMs: number,
  cwd: string,
): WorkspaceInitialModelSnapshot {
  return {
    gitRoot: discoverGitRoot(cwd),
    entries: loadEntries(cwd),
    searchRoot: portableFileSearchPath(cwd),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter(),
    nowMs,
  };
}
