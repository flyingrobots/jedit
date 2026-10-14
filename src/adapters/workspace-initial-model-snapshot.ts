import { BijouI18nAdapter } from "./bijou-i18n-adapter.js";
import type { WorkspaceInitialModelSnapshot } from "../app/workspace/init.js";
import {
  JEDIT_THEME_ENV,
  resolveInitialJeditTheme,
} from "../ui/jedit-themes.js";
import { loadEntries } from "./filesystem.js";

export function createInitialModelSnapshot(
  nowMs: number,
  cwd: string,
): WorkspaceInitialModelSnapshot {
  return {
    entries: loadEntries(cwd),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter(),
    nowMs,
  };
}
