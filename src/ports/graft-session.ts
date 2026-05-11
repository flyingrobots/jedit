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

export interface GraftSessionPort {
  loadGraftInfo(workspaceRoot: string, filePath: string, dirty: boolean): Promise<GraftInfo>;
  failedGraftInfo(workspaceRoot: string, filePath: string, dirty: boolean, message: string): GraftInfo;
  closeConnection(): Promise<void>;
}
