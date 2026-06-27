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
