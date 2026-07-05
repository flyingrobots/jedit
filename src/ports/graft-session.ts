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

export interface GraftObstructionReceiptProjection {
  readonly outcomeKind: string;
  readonly targetIrDigest: string;
  readonly targetIrDomain?: string;
  readonly reasonKind?: string;
  readonly reasonPayload?: GraftJsonObject;
  readonly receipt?: GraftJsonObject;
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
  readonly obstructionReceipt?: GraftObstructionReceiptProjection;
  readonly notice?: string;
  readonly error?: string;
}

export interface GraftFileRequest {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly dirty: boolean;
}

export interface FailedGraftInfoRequest extends GraftFileRequest {
  readonly message: string;
}

export interface GraftSessionPort {
  loadGraftInfo(request: GraftFileRequest): Promise<GraftInfo>;
  failedGraftInfo(request: FailedGraftInfoRequest): GraftInfo;
  closeConnection(): Promise<void>;
}
