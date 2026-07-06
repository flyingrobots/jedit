export const GraftProjectionSources = Object.freeze({
  SavedFile: 'saved-file',
  LiveBuffer: 'live-buffer',
  CurrentEchoFrontier: 'current-Echo-frontier',
  ColorfulProse: 'colorful-prose',
  Unavailable: 'unavailable',
} as const);

export type GraftProjectionSource = typeof GraftProjectionSources[keyof typeof GraftProjectionSources];

export const GraftProjectionPostures = Object.freeze({
  Current: 'current',
  Stale: 'stale',
  Obstructed: 'obstructed',
  Unavailable: 'unavailable',
} as const);

export type GraftProjectionPosture = typeof GraftProjectionPostures[keyof typeof GraftProjectionPostures];

export type GraftJsonPrimitive = string | number | boolean | null;
export type GraftJsonValue = GraftJsonPrimitive | readonly GraftJsonValue[] | GraftJsonObject;

export interface GraftJsonObject {
  readonly [key: string]: GraftJsonValue;
}

export const GraftProjectionSlotStates = Object.freeze({
  NotRequested: 'not_requested',
  Available: 'available',
  Blocked: 'blocked',
  Failed: 'failed',
} as const);

export type GraftProjectionSlotState = typeof GraftProjectionSlotStates[keyof typeof GraftProjectionSlotStates];

export interface GraftEdictProjectionLane {
  readonly state: GraftProjectionSlotState;
  readonly digest?: string;
  readonly summaryLines: readonly string[];
}

export interface GraftEchoTargetIrProjectionLane extends GraftEdictProjectionLane {
  readonly domain?: string;
  readonly targetCoordinate?: string;
  readonly targetProfileDigest?: string;
}

export interface GraftObstructionReceiptProjection {
  readonly outcomeKind: string;
  readonly targetIrDigest: string;
  readonly targetIrDomain?: string;
  readonly reasonKind?: string;
  readonly reasonPayload?: GraftJsonObject;
  readonly receipt?: GraftJsonObject;
}

export interface GraftProjectionPanelDigest {
  readonly label: string;
  readonly value: string;
}

export interface GraftProjectionPanelMetadata {
  readonly label: string;
  readonly value: string;
}

export interface GraftProjectionPanelLane {
  readonly title: string;
  readonly state: GraftProjectionSlotState;
  readonly digest?: GraftProjectionPanelDigest;
  readonly metadata: readonly GraftProjectionPanelMetadata[];
  readonly summaryLines: readonly string[];
}

export interface GraftInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly dirty: boolean;
  readonly projectionSource: GraftProjectionSource;
  readonly projectionPosture: GraftProjectionPosture;
  readonly outlineItems: readonly {
    readonly kind: string;
    readonly name: string;
    readonly startLine: number;
    readonly endLine: number;
  }[];
  readonly changeLines: readonly string[];
  readonly projectionLanes?: readonly GraftProjectionPanelLane[];
  readonly edictCoreProjection?: GraftEdictProjectionLane;
  readonly echoTargetIrProjection?: GraftEchoTargetIrProjectionLane;
  readonly obstructionReceipt?: GraftObstructionReceiptProjection;
  readonly notice?: string;
  readonly error?: string;
}

export interface GraftFileRequest {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly dirty: boolean;
  readonly sourceText?: string;
}

export interface FailedGraftInfoRequest extends GraftFileRequest {
  readonly message: string;
}

export interface GraftSessionPort {
  loadGraftInfo(request: GraftFileRequest): Promise<GraftInfo>;
  failedGraftInfo(request: FailedGraftInfoRequest): GraftInfo;
  closeConnection(): Promise<void>;
}
