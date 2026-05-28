import type { EchoPoweredTextBufferWitnessReport } from './echo-powered-text-buffer-witness.js';

export const JEDIT_ECHO_WITNESS_SCHEMA_VERSION = 1;
export const JEDIT_ECHO_WITNESS_REPLAY_UNAVAILABLE = 'UNAVAILABLE';
export const JEDIT_ECHO_WITNESS_TRANSPORT_INSTALLED_CONTRACT = 'installed-jedit-contract';

export type JeditEchoWitnessTransport =
  typeof JEDIT_ECHO_WITNESS_TRANSPORT_INSTALLED_CONTRACT;

export interface JeditEchoWitnessInstallSummary {
  readonly packageId: string;
  readonly version: string;
  readonly schemaId: string;
  readonly artifactId: string;
  readonly codecId: string;
}

export interface JeditEchoWitnessReplayPosture {
  readonly status: typeof JEDIT_ECHO_WITNESS_REPLAY_UNAVAILABLE;
  readonly reason: string;
}

export interface JeditEchoWitnessDryRunPlan {
  readonly bufferKey: string;
  readonly cycleLimit: number;
  readonly submitIntent: true;
  readonly trustedHostDrainsRuntime: true;
  readonly appCanTick: false;
}

export interface JeditEchoWitnessReadingSummary {
  readonly readingId: string;
  readonly lineCount: number;
  readonly truncated: boolean;
}

export interface JeditEchoWitnessDryRunSummary {
  readonly ok: true;
  readonly schemaVersion: typeof JEDIT_ECHO_WITNESS_SCHEMA_VERSION;
  readonly transport: JeditEchoWitnessTransport;
  readonly dryRun: true;
  readonly install: JeditEchoWitnessInstallSummary;
  readonly plan: JeditEchoWitnessDryRunPlan;
  readonly replay: JeditEchoWitnessReplayPosture;
}

export interface JeditEchoWitnessRunSummary {
  readonly ok: true;
  readonly schemaVersion: typeof JEDIT_ECHO_WITNESS_SCHEMA_VERSION;
  readonly transport: JeditEchoWitnessTransport;
  readonly dryRun: false;
  readonly install: JeditEchoWitnessInstallSummary;
  readonly report: EchoPoweredTextBufferWitnessReport;
  readonly reading: JeditEchoWitnessReadingSummary;
  readonly replay: JeditEchoWitnessReplayPosture;
}

export type JeditEchoWitnessSummary =
  | JeditEchoWitnessDryRunSummary
  | JeditEchoWitnessRunSummary;

export interface JeditEchoWitnessRequest {
  readonly bufferKey: string;
  readonly insertText: string;
  readonly cycleLimit: number;
}

export interface JeditEchoAgentWitnessPort {
  dryRun(request: JeditEchoWitnessRequest): Promise<JeditEchoWitnessDryRunSummary>;
  run(request: JeditEchoWitnessRequest): Promise<JeditEchoWitnessRunSummary>;
}
