export type DrawerKind = 'files' | 'graft';

export interface DrawerLayout {
  readonly width: number;
  readonly x: number;
}

const FILE_DRAWER_MIN_WIDTH = 22;
const FILE_DRAWER_MAX_WIDTH = 34;
const FILE_DRAWER_WIDTH_RATIO = 0.26;
const GRAFT_DRAWER_MAX_WIDTH = 80;
const GRAFT_DRAWER_WIDTH_RATIO = 0.5;

export function resolveDrawerLayout(kind: DrawerKind, columns: number, progress: number): DrawerLayout {
  const width = Math.round(resolveDrawerMaxWidth(kind, columns) * clamp01(progress));
  return {
    width,
    x: kind === 'graft' ? Math.max(0, columns - width) : 0,
  };
}

function resolveDrawerMaxWidth(kind: DrawerKind, columns: number): number {
  if (kind === 'graft') {
    return Math.max(0, Math.min(GRAFT_DRAWER_MAX_WIDTH, Math.floor(columns * GRAFT_DRAWER_WIDTH_RATIO)));
  }

  return Math.max(FILE_DRAWER_MIN_WIDTH, Math.min(FILE_DRAWER_MAX_WIDTH, Math.floor(columns * FILE_DRAWER_WIDTH_RATIO)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
