export const DrawerKinds = Object.freeze({
  Files: 'files',
  Graft: 'graft',
} as const);

export type DrawerKind = typeof DrawerKinds[keyof typeof DrawerKinds];

export interface DrawerLayout {
  readonly width: number;
  readonly x: number;
}

export interface WorkspaceLayout {
  readonly fileDrawer: DrawerLayout;
  readonly graftDrawer: DrawerLayout;
  readonly viewer: {
    readonly width: number;
    readonly x: number;
  };
}

const FILE_DRAWER_MIN_WIDTH = 22;
const FILE_DRAWER_MAX_WIDTH = 34;
const FILE_DRAWER_WIDTH_RATIO = 0.26;
const MIN_VIEWER_WIDTH_WITH_DRAWERS = 24;
const NO_DRAWER_WIDTH = 0;
const WIDTH_UNIT = 1;
const DRAWER_INDEX_FILES = 0;
const DRAWER_INDEX_GRAFT = 1;

export function resolveDrawerLayout(kind: DrawerKind, columns: number, progress: number, rightOffset = 0): DrawerLayout {
  return drawerLayoutForWidth(kind, columns, resolveDrawerWidth(kind, columns, progress), rightOffset);
}

export function resolveWorkspaceLayout(
  columns: number,
  fileDrawerProgress: number,
  graftDrawerProgress: number,
): WorkspaceLayout {
  const widths = fitDrawerWidths([
    resolveDrawerWidth(DrawerKinds.Files, columns, fileDrawerProgress),
    resolveDrawerWidth(DrawerKinds.Graft, columns, graftDrawerProgress),
  ], Math.max(NO_DRAWER_WIDTH, columns - MIN_VIEWER_WIDTH_WITH_DRAWERS));
  const fileDrawer = drawerLayoutForWidth(DrawerKinds.Files, columns, widths[DRAWER_INDEX_FILES] ?? NO_DRAWER_WIDTH);
  const graftDrawer = drawerLayoutForWidth(
    DrawerKinds.Graft,
    columns,
    widths[DRAWER_INDEX_GRAFT] ?? NO_DRAWER_WIDTH,
  );
  return {
    fileDrawer,
    graftDrawer,
    viewer: {
      width: Math.max(1, columns - fileDrawer.width - graftDrawer.width),
      x: fileDrawer.width,
    },
  };
}

function resolveDrawerWidth(kind: DrawerKind, columns: number, progress: number): number {
  return Math.round(resolveDrawerMaxWidth(kind, columns) * clamp01(progress));
}

function drawerLayoutForWidth(kind: DrawerKind, columns: number, width: number, rightOffset = 0): DrawerLayout {
  return {
    width,
    x: isRightDrawer(kind) ? Math.max(0, columns - rightOffset - width) : 0,
  };
}

function fitDrawerWidths(widths: readonly number[], maxTotal: number): readonly number[] {
  const total = widths.reduce((sum, width) => sum + width, NO_DRAWER_WIDTH);
  if (total <= maxTotal) {
    return widths;
  }
  if (maxTotal <= NO_DRAWER_WIDTH) {
    return widths.map(() => NO_DRAWER_WIDTH);
  }
  return distributeScaledWidths(widths, maxTotal / total, maxTotal);
}

function distributeScaledWidths(widths: readonly number[], scale: number, maxTotal: number): readonly number[] {
  const scaled = widths.map((width) => Math.floor(width * scale));
  const remaining = maxTotal - scaled.reduce((sum, width) => sum + width, NO_DRAWER_WIDTH);
  return scaled.map((width, index) => (
    index < remaining && (widths[index] ?? NO_DRAWER_WIDTH) > NO_DRAWER_WIDTH ? width + WIDTH_UNIT : width
  ));
}

function resolveDrawerMaxWidth(_kind: DrawerKind, columns: number): number {
  return resolveFileDrawerMaxWidth(columns);
}

function resolveFileDrawerMaxWidth(columns: number): number {
  return Math.max(FILE_DRAWER_MIN_WIDTH, Math.min(FILE_DRAWER_MAX_WIDTH, Math.floor(columns * FILE_DRAWER_WIDTH_RATIO)));
}

function isRightDrawer(kind: DrawerKind): boolean {
  return kind === DrawerKinds.Graft;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
