export const GRAFT_DIAGNOSTIC_STATUS = Object.freeze({
  Ok: 'ok',
  Warning: 'warn',
  Error: 'error',
} as const);

export type GraftDiagnosticStatus =
  typeof GRAFT_DIAGNOSTIC_STATUS[keyof typeof GRAFT_DIAGNOSTIC_STATUS];

export interface GraftDiagnosticRow {
  readonly label: string;
  readonly value: string;
  readonly status: GraftDiagnosticStatus;
  readonly detail?: string;
}

export interface GraftDiagnosticsReport {
  readonly title: string;
  readonly summary: string;
  readonly rows: readonly GraftDiagnosticRow[];
}

export interface FailedGraftDiagnosticsRequest {
  readonly message: string;
}

export interface GraftDiagnosticsPort {
  loadDiagnostics(): Promise<GraftDiagnosticsReport>;
  failedDiagnostics(request: FailedGraftDiagnosticsRequest): GraftDiagnosticsReport;
}
