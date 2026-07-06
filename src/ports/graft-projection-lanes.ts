import type {
  GraftEchoTargetIrProjectionLane,
  GraftEdictProjectionLane,
  GraftProjectionPanelDigest,
  GraftProjectionPanelLane,
  GraftProjectionPanelMetadata,
} from './graft-session.js';

const EDICT_CORE_TITLE = 'edict core';
const EDICT_CORE_DIGEST_LABEL = 'core digest';
const ECHO_TARGET_IR_TITLE = 'echo target ir';
const ECHO_TARGET_IR_DOMAIN_LABEL = 'domain';
const ECHO_TARGET_IR_TARGET_LABEL = 'target';
const ECHO_TARGET_IR_PROFILE_LABEL = 'target profile';
const ECHO_TARGET_IR_DIGEST_LABEL = 'target ir digest';
const PROJECTION_TITLE_ROWS = 1;
const PROJECTION_STATE_ROWS = 1;
const PROJECTION_DIGEST_ROWS = 1;

export interface GraftProjectionLaneSource {
  readonly projectionLanes?: readonly GraftProjectionPanelLane[];
  readonly edictCoreProjection?: GraftEdictProjectionLane;
  readonly echoTargetIrProjection?: GraftEchoTargetIrProjectionLane;
}

export function graftProjectionPanelLanes(source: GraftProjectionLaneSource): readonly GraftProjectionPanelLane[] {
  if (source.projectionLanes != null) {
    return source.projectionLanes;
  }

  return [
    ...edictCorePanelLane(source.edictCoreProjection),
    ...echoTargetIrPanelLane(source.echoTargetIrProjection),
  ];
}

export function graftProjectionPanelLaneRowCount(lane: GraftProjectionPanelLane): number {
  return PROJECTION_TITLE_ROWS
    + PROJECTION_STATE_ROWS
    + (lane.digest == null ? 0 : PROJECTION_DIGEST_ROWS)
    + lane.metadata.length
    + lane.summaryLines.length;
}

function edictCorePanelLane(projection: GraftEdictProjectionLane | undefined): readonly GraftProjectionPanelLane[] {
  if (projection == null) {
    return [];
  }

  return [{
    title: EDICT_CORE_TITLE,
    state: projection.state,
    metadata: [],
    summaryLines: projection.summaryLines,
    ...(projection.digest == null ? {} : { digest: projectionDigest(EDICT_CORE_DIGEST_LABEL, projection.digest) }),
  }];
}

function echoTargetIrPanelLane(projection: GraftEchoTargetIrProjectionLane | undefined): readonly GraftProjectionPanelLane[] {
  if (projection == null) {
    return [];
  }

  return [{
    title: ECHO_TARGET_IR_TITLE,
    state: projection.state,
    metadata: echoTargetIrMetadata(projection),
    summaryLines: projection.summaryLines,
    ...(projection.digest == null ? {} : { digest: projectionDigest(ECHO_TARGET_IR_DIGEST_LABEL, projection.digest) }),
  }];
}

function projectionDigest(label: string, value: string): GraftProjectionPanelDigest {
  return { label, value };
}

function echoTargetIrMetadata(projection: GraftEchoTargetIrProjectionLane): readonly GraftProjectionPanelMetadata[] {
  return [
    ...projectionMetadata(ECHO_TARGET_IR_DOMAIN_LABEL, projection.domain),
    ...projectionMetadata(ECHO_TARGET_IR_TARGET_LABEL, projection.targetCoordinate),
    ...projectionMetadata(ECHO_TARGET_IR_PROFILE_LABEL, projection.targetProfileDigest),
  ];
}

function projectionMetadata(label: string, value: string | undefined): readonly GraftProjectionPanelMetadata[] {
  return value == null ? [] : [{ label, value }];
}
