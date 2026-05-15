export interface GraftInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly dirty: boolean;
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
