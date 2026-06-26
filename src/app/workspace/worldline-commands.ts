import { clampIndex } from './viewport.js';
import {
  canonicalPosture,
  DEFAULT_ADMISSION_TARGET,
  DEFAULT_BRAID_PREFIX,
  DEFAULT_HEAD_TICK,
  DEFAULT_STRAND_PREFIX,
  MAIN_WORLDLINE_NAME,
  WorkspaceWorldlineConflictKinds,
  WorkspaceWorldlineNodeKinds,
  WorkspaceWorldlinePostureKinds,
  workspaceWorldlinePostureLabel,
  type WorkspaceWorldlineGraphNode,
  type WorkspaceWorldlineState,
} from './worldline-types.js';

const EMPTY_LENGTH = 0;
const MISSING_INDEX = -1;
const MAIN_GRAPH_INDEX = 0;
const DUPLICATE_SUFFIX_START = 2;
const ORDINAL_STEP = 1;
const RELATIVE_TICK_PATTERN = /^[+-]\d+$/;
const ABSOLUTE_TICK_PATTERN = /^\d+$/;
const TTD_HEAD_ARGUMENT = 'head';
const TTD_HERE_ARGUMENT = 'here';
const TTD_VALID = 'valid';
const TTD_INVALID = 'invalid';

export interface WorkspaceTtdCommandResult {
  readonly kind: typeof TTD_VALID | typeof TTD_INVALID;
  readonly worldline?: WorkspaceWorldlineState;
}

export function applyTtdCommand(
  worldline: WorkspaceWorldlineState,
  argument: string,
): WorkspaceTtdCommandResult {
  const trimmed = argument.trim();
  if (trimmed.length === EMPTY_LENGTH) {
    return invalidTtdCommand();
  }
  if (trimmed === TTD_HEAD_ARGUMENT) {
    return validTtdCommand(worldlineAtCanonicalHead(worldline));
  }
  if (trimmed === TTD_HERE_ARGUMENT) {
    return validTtdCommand(worldline);
  }

  const tick = observedTickFromTtdArgument(worldline, trimmed);
  if (tick == null) {
    return invalidTtdCommand();
  }
  return validTtdCommand(tick === worldline.canonicalHeadTick
    ? worldlineAtCanonicalHead(worldline)
    : worldlineAtObservedTick(worldline, tick));
}

export function createWorkspaceStrand(
  worldline: WorkspaceWorldlineState,
  requestedName: string | undefined,
): WorkspaceWorldlineState {
  const name = uniqueGraphNodeName(
    worldline.graph,
    sanitizedName(requestedName) ?? `${DEFAULT_STRAND_PREFIX}-${worldline.nextStrandOrdinal}`,
  );
  const basisTick = currentObserverTick(worldline);
  const node = strandGraphNode(worldline, name, basisTick);
  return withSelectedGraphNode({
    ...worldline,
    posture: {
      kind: WorkspaceWorldlinePostureKinds.Strand,
      name,
      basisTick,
      headTick: basisTick,
      admissionTarget: DEFAULT_ADMISSION_TARGET,
    },
    graph: [...worldline.graph, node],
    nextStrandOrdinal: worldline.nextStrandOrdinal + ORDINAL_STEP,
  }, node.id);
}

export function switchWorkspaceStrand(
  worldline: WorkspaceWorldlineState,
  name: string,
): WorkspaceWorldlineState | undefined {
  if (name === MAIN_WORLDLINE_NAME) {
    return worldlineAtCanonicalHead(worldline);
  }

  const node = findStrandGraphNode(worldline, name);
  return node == null
    ? undefined
    : withSelectedGraphNode({
      ...worldline,
      posture: {
        kind: strandPostureKind(node),
        name: node.name,
        basisTick: node.basisTick,
        headTick: node.headTick,
        admissionTarget: DEFAULT_ADMISSION_TARGET,
      },
    }, node.id);
}

export function previewWorkspaceBraid(
  worldline: WorkspaceWorldlineState,
  memberName: string | undefined,
): WorkspaceWorldlineState | undefined {
  const strand = memberName == null
    ? currentStrandNode(worldline)
    : findStrandGraphNode(worldline, memberName);
  if (strand == null) {
    return undefined;
  }

  const name = uniqueGraphNodeName(
    worldline.graph,
    `${DEFAULT_BRAID_PREFIX}-${worldline.nextBraidOrdinal}`,
  );
  const node = braidGraphNode(worldline, name, strand);
  return withSelectedGraphNode({
    ...worldline,
    posture: {
      kind: WorkspaceWorldlinePostureKinds.BraidPreview,
      name,
      basisTick: node.basisTick,
      headTick: node.headTick,
      admissionTarget: DEFAULT_ADMISSION_TARGET,
    },
    graph: [...worldline.graph, node],
    nextBraidOrdinal: worldline.nextBraidOrdinal + ORDINAL_STEP,
  }, node.id);
}

export function admitWorkspaceBraid(
  worldline: WorkspaceWorldlineState,
  memberName: string | undefined,
): WorkspaceWorldlineState | undefined {
  const preview = memberName == null
    ? currentBraidNode(worldline)
    : findBraidForMember(worldline, memberName);
  if (preview == null || preview.conflict !== WorkspaceWorldlineConflictKinds.Clear) {
    return undefined;
  }
  const nextGraph = worldline.graph.map((node) =>
    node.id === preview.id ? { ...node, admitted: true, behind: 0 } : node
  );
  return {
    ...worldline,
    canonicalHeadTick: preview.headTick ?? worldline.canonicalHeadTick,
    posture: canonicalPosture(preview.headTick ?? worldline.canonicalHeadTick),
    graph: nextGraph,
    selectedGraphIndex: indexOfGraphNode(nextGraph, MAIN_WORLDLINE_NAME),
  };
}

function worldlineAtCanonicalHead(
  worldline: WorkspaceWorldlineState,
): WorkspaceWorldlineState {
  return {
    ...worldline,
    posture: canonicalPosture(worldline.canonicalHeadTick),
    selectedGraphIndex: indexOfGraphNode(worldline.graph, MAIN_WORLDLINE_NAME),
  };
}

function worldlineAtObservedTick(
  worldline: WorkspaceWorldlineState,
  tick: number,
): WorkspaceWorldlineState {
  return {
    ...worldline,
    posture: {
      kind: WorkspaceWorldlinePostureKinds.Historical,
      name: MAIN_WORLDLINE_NAME,
      basisTick: worldline.canonicalHeadTick,
      observedTick: tick,
      headTick: worldline.canonicalHeadTick,
      admissionTarget: DEFAULT_ADMISSION_TARGET,
    },
    selectedGraphIndex: indexOfGraphNode(worldline.graph, MAIN_WORLDLINE_NAME),
  };
}

function strandGraphNode(
  worldline: WorkspaceWorldlineState,
  name: string,
  basisTick: number,
): WorkspaceWorldlineGraphNode {
  return {
    id: `strand:${name}`,
    kind: WorkspaceWorldlineNodeKinds.Strand,
    name,
    basis: observerBasisLabel(worldline),
    basisTick,
    headTick: basisTick,
    ahead: 0,
    behind: Math.max(0, worldline.canonicalHeadTick - basisTick),
    conflict: WorkspaceWorldlineConflictKinds.Clear,
  };
}

function braidGraphNode(
  worldline: WorkspaceWorldlineState,
  name: string,
  strand: WorkspaceWorldlineGraphNode,
): WorkspaceWorldlineGraphNode {
  return {
    id: `braid:${name}`,
    kind: WorkspaceWorldlineNodeKinds.Braid,
    name,
    basis: `${MAIN_WORLDLINE_NAME}+${strand.name}`,
    basisTick: strand.basisTick,
    headTick: worldline.canonicalHeadTick,
    ahead: strand.ahead,
    behind: strand.behind,
    conflict: strand.conflict,
    members: [MAIN_WORLDLINE_NAME, strand.name],
    admitted: false,
  };
}

function observedTickFromTtdArgument(
  worldline: WorkspaceWorldlineState,
  argument: string,
): number | undefined {
  if (RELATIVE_TICK_PATTERN.test(argument)) {
    return clampedTick(
      currentObserverTick(worldline) + Number.parseInt(argument, 10),
      worldline.canonicalHeadTick,
    );
  }
  return ABSOLUTE_TICK_PATTERN.test(argument)
    ? clampedTick(Number.parseInt(argument, 10), worldline.canonicalHeadTick)
    : undefined;
}

function clampedTick(tick: number, headTick: number): number {
  return Math.max(DEFAULT_HEAD_TICK, Math.min(headTick, tick));
}

function currentObserverTick(worldline: WorkspaceWorldlineState): number {
  return worldline.posture.observedTick ??
    worldline.posture.headTick ??
    worldline.canonicalHeadTick;
}

function observerBasisLabel(worldline: WorkspaceWorldlineState): string {
  return worldline.posture.kind === WorkspaceWorldlinePostureKinds.Historical
    ? workspaceWorldlinePostureLabel(worldline.posture)
    : worldline.posture.name;
}

function strandPostureKind(node: WorkspaceWorldlineGraphNode) {
  return node.kind === WorkspaceWorldlineNodeKinds.Agent
    ? WorkspaceWorldlinePostureKinds.Agent
    : WorkspaceWorldlinePostureKinds.Strand;
}

function currentStrandNode(
  worldline: WorkspaceWorldlineState,
): WorkspaceWorldlineGraphNode | undefined {
  return isStrandPosture(worldline)
    ? findStrandGraphNode(worldline, worldline.posture.name)
    : undefined;
}

function currentBraidNode(
  worldline: WorkspaceWorldlineState,
): WorkspaceWorldlineGraphNode | undefined {
  return worldline.posture.kind === WorkspaceWorldlinePostureKinds.BraidPreview
    ? worldline.graph.find((node) =>
      node.kind === WorkspaceWorldlineNodeKinds.Braid &&
      node.name === worldline.posture.name
    )
    : undefined;
}

function findStrandGraphNode(
  worldline: WorkspaceWorldlineState,
  name: string,
): WorkspaceWorldlineGraphNode | undefined {
  return worldline.graph.find((node) => isStrandNode(node) && node.name === name);
}

function findBraidForMember(
  worldline: WorkspaceWorldlineState,
  memberName: string,
): WorkspaceWorldlineGraphNode | undefined {
  return worldline.graph.find((node) =>
    node.kind === WorkspaceWorldlineNodeKinds.Braid &&
    node.members?.includes(memberName) === true &&
    node.admitted !== true
  );
}

function isStrandPosture(worldline: WorkspaceWorldlineState): boolean {
  return worldline.posture.kind === WorkspaceWorldlinePostureKinds.Strand ||
    worldline.posture.kind === WorkspaceWorldlinePostureKinds.Agent;
}

function isStrandNode(node: WorkspaceWorldlineGraphNode): boolean {
  return node.kind === WorkspaceWorldlineNodeKinds.Strand ||
    node.kind === WorkspaceWorldlineNodeKinds.Agent;
}

function withSelectedGraphNode(
  worldline: WorkspaceWorldlineState,
  nodeId: string,
): WorkspaceWorldlineState {
  const index = worldline.graph.findIndex((node) => node.id === nodeId);
  return {
    ...worldline,
    selectedGraphIndex: clampIndex(
      index === MISSING_INDEX ? MAIN_GRAPH_INDEX : index,
      worldline.graph.length,
    ),
  };
}

function indexOfGraphNode(
  graph: readonly WorkspaceWorldlineGraphNode[],
  name: string,
): number {
  const index = graph.findIndex((node) => node.name === name);
  return clampIndex(index === MISSING_INDEX ? MAIN_GRAPH_INDEX : index, graph.length);
}

function sanitizedName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed == null || trimmed.length === EMPTY_LENGTH ? undefined : trimmed;
}

function uniqueGraphNodeName(
  graph: readonly WorkspaceWorldlineGraphNode[],
  baseName: string,
): string {
  if (!graph.some((node) => node.name === baseName)) {
    return baseName;
  }
  let ordinal = DUPLICATE_SUFFIX_START;
  let candidate = `${baseName}-${ordinal}`;
  while (graph.some((node) => node.name === candidate)) {
    ordinal += ORDINAL_STEP;
    candidate = `${baseName}-${ordinal}`;
  }
  return candidate;
}

function validTtdCommand(worldline: WorkspaceWorldlineState): WorkspaceTtdCommandResult {
  return {
    kind: TTD_VALID,
    worldline,
  };
}

function invalidTtdCommand(): WorkspaceTtdCommandResult {
  return {
    kind: TTD_INVALID,
  };
}
