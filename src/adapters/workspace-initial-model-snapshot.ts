import { BijouI18nAdapter } from './bijou-i18n-adapter.js';
import type { WorkspaceInitialModelSnapshot } from '../app/workspace/init.js';
import { JEDIT_THEME_ENV, resolveInitialJeditTheme } from '../ui/jedit-themes.js';
import { loadEntries } from './filesystem.js';
import { loadStartupTitleMeshes } from './workspace-title-meshes.js';

export function createInitialModelSnapshot(
  nowMs: number,
  cwd: string,
  random: () => number,
): WorkspaceInitialModelSnapshot {
  return {
    entries: loadEntries(cwd),
    titleMeshes: loadStartupTitleMeshes(),
    titleSceneSeed: random(),
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    i18n: new BijouI18nAdapter('en', 'ltr'),
    nowMs,
  };
}
