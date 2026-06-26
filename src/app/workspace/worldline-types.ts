const POSTURE_CANONICAL = 'canonical';
const POSTURE_HISTORICAL = 'historical';
const POSTURE_STRAND = 'strand';
const POSTURE_AGENT = 'agent';
const POSTURE_BRAID_PREVIEW = 'braid-preview';
const NODE_CANONICAL = 'canonical';
const NODE_STRAND = 'strand';
const NODE_AGENT = 'agent';
const NODE_BRAID = 'braid';
const CONFLICT_CLEAR = 'clear';
const CONFLICT_CONFLICT = 'conflict';
const CONFLICT_OBSTRUCTED = 'obstructed';
const MATERIALIZED = 'materialized';
const UNMATERIALIZED = 'unmaterialized';
const NO_PROJECTION = 'no-projection';
const VIEW_ECHO = 'echo';
const VIEW_WORLDLINES = 'worldlines';

export const MAIN_WORLDLINE_NAME = 'main';
export const DEFAULT_ADMISSION_TARGET = MAIN_WORLDLINE_NAME;
export const DEFAULT_HEAD_TICK = 0;
export const DEFAULT_STRAND_PREFIX = 'strand';
export const DEFAULT_BRAID_PREFIX = 'braid';

export const WorkspaceWorldlinePostureKinds = Object.freeze({
  Canonical: POSTURE_CANONICAL,
  Historical: POSTURE_HISTORICAL,
  Strand: POSTURE_STRAND,
  Agent: POSTURE_AGENT,
  BraidPreview: POSTURE_BRAID_PREVIEW,
} as const);

export const WorkspaceWorldlineNodeKinds = Object.freeze({
  Canonical: NODE_CANONICAL,
  Strand: NODE_STRAND,
  Agent: NODE_AGENT,
  Braid: NODE_BRAID,
} as const);

export const WorkspaceWorldlineConflictKinds = Object.freeze({
  Clear: CONFLICT_CLEAR,
  Conflict: CONFLICT_CONFLICT,
  Obstructed: CONFLICT_OBSTRUCTED,
} as const);

export const WorkspaceWorldlineMaterializationKinds = Object.freeze({
  Materialized: MATERIALIZED,
  Unmaterialized: UNMATERIALIZED,
  NoProjection: NO_PROJECTION,
} as const);

export const WorkspaceHistoryDrawerViews = Object.freeze({
  Echo: VIEW_ECHO,
  Worldlines: VIEW_WORLDLINES,
} as const);

export type WorkspaceWorldlinePostureKind =
  typeof WorkspaceWorldlinePostureKinds[keyof typeof WorkspaceWorldlinePostureKinds];
export type WorkspaceWorldlineNodeKind =
  typeof WorkspaceWorldlineNodeKinds[keyof typeof WorkspaceWorldlineNodeKinds];
export type WorkspaceWorldlineConflictKind =
  typeof WorkspaceWorldlineConflictKinds[keyof typeof WorkspaceWorldlineConflictKinds];
export type WorkspaceWorldlineMaterializationKind =
  typeof WorkspaceWorldlineMaterializationKinds[keyof typeof WorkspaceWorldlineMaterializationKinds];
export type WorkspaceHistoryDrawerView =
  typeof WorkspaceHistoryDrawerViews[keyof typeof WorkspaceHistoryDrawerViews];

export interface WorkspaceWorldlinePosture {
  readonly kind: WorkspaceWorldlinePostureKind;
  readonly name: string;
  readonly basisTick?: number;
  readonly observedTick?: number;
  readonly headTick?: number;
  readonly admissionTarget: string;
}

export interface WorkspaceWorldlineGraphNode {
  readonly id: string;
  readonly kind: WorkspaceWorldlineNodeKind;
  readonly name: string;
  readonly basis: string;
  readonly basisTick?: number;
  readonly headTick?: number;
  readonly ahead: number;
  readonly behind: number;
  readonly conflict: WorkspaceWorldlineConflictKind;
  readonly members?: readonly string[];
  readonly admitted?: boolean;
}

export interface WorkspaceWorldlineState {
  readonly canonicalHeadTick: number;
  readonly posture: WorkspaceWorldlinePosture;
  readonly graph: readonly WorkspaceWorldlineGraphNode[];
  readonly selectedGraphIndex: number;
  readonly nextStrandOrdinal: number;
  readonly nextBraidOrdinal: number;
}

export function initialWorkspaceWorldlineState(): WorkspaceWorldlineState {
  return {
    canonicalHeadTick: DEFAULT_HEAD_TICK,
    posture: canonicalPosture(DEFAULT_HEAD_TICK),
    graph: [canonicalGraphNode(DEFAULT_HEAD_TICK)],
    selectedGraphIndex: 0,
    nextStrandOrdinal: 1,
    nextBraidOrdinal: 1,
  };
}

export function workspaceWorldlineMaterialization(
  editorDirty: boolean | undefined,
): WorkspaceWorldlineMaterializationKind {
  if (editorDirty == null) {
    return WorkspaceWorldlineMaterializationKinds.NoProjection;
  }
  return editorDirty
    ? WorkspaceWorldlineMaterializationKinds.Unmaterialized
    : WorkspaceWorldlineMaterializationKinds.Materialized;
}

export function workspaceWorldlinePostureLabel(
  posture: WorkspaceWorldlinePosture,
): string {
  if (posture.kind === WorkspaceWorldlinePostureKinds.Canonical) {
    return MAIN_WORLDLINE_NAME;
  }
  if (posture.kind === WorkspaceWorldlinePostureKinds.Historical) {
    return `observe:t${posture.observedTick ?? posture.basisTick ?? DEFAULT_HEAD_TICK}`;
  }
  if (posture.kind === WorkspaceWorldlinePostureKinds.BraidPreview) {
    return `braid:${posture.name} preview`;
  }
  return `${posture.kind}:${posture.name}`;
}

export function canonicalPosture(headTick: number): WorkspaceWorldlinePosture {
  return {
    kind: WorkspaceWorldlinePostureKinds.Canonical,
    name: MAIN_WORLDLINE_NAME,
    basisTick: headTick,
    headTick,
    admissionTarget: DEFAULT_ADMISSION_TARGET,
  };
}

export function canonicalGraphNode(headTick: number): WorkspaceWorldlineGraphNode {
  return {
    id: `worldline:${MAIN_WORLDLINE_NAME}`,
    kind: WorkspaceWorldlineNodeKinds.Canonical,
    name: MAIN_WORLDLINE_NAME,
    basis: MAIN_WORLDLINE_NAME,
    basisTick: headTick,
    headTick,
    ahead: 0,
    behind: 0,
    conflict: WorkspaceWorldlineConflictKinds.Clear,
  };
}
