import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import {
  EchoTextHostOutcomeKinds,
  EchoTextHostCheckpointReasons,
  type EchoTextContractHostPort,
  type EchoTextHostCheckpointOutcome,
  type EchoTextHostCheckpointRequest,
  type EchoTextHostObserveOutcome,
  type EchoTextHostObserveRequest,
  type EchoTextHostOpenOutcome,
  type EchoTextHostOpenRequest,
  type EchoTextHostReplaceOutcome,
  type EchoTextHostReplaceRequest,
} from '../ports/echo-text-contract-host.js';

const HOST_BINARY_ENV = 'JEDIT_ECHO_HOST_BIN';
const HOST_WAL_DIRECTORY_ENV = 'JEDIT_ECHO_WAL_DIR';
const DEFAULT_HOST_BINARY = 'native/jedit-echo-host/target/debug/jedit-echo-host';
const HOST_UNAVAILABLE_CODE = 'echo-host-unavailable';
const HOST_PROTOCOL_CODE = 'echo-host-protocol-obstructed';
const STDERR_LIMIT = 8192;

const BufferEvidenceSchema = z.object({
  bufferId: z.string().min(1),
  bufferKey: z.string().min(1),
  projectionPath: z.string().nullable(),
  headId: z.string().min(1),
  rootNodeId: z.string().nullable(),
  byteLength: z.number().int().nonnegative(),
  lineCount: z.number().int().positive(),
  bufferVersion: z.number().int().nonnegative(),
});

const WireOpenedSchema = BufferEvidenceSchema.extend({
  kind: z.literal(EchoTextHostOutcomeKinds.Opened),
  requestId: z.number().int().nonnegative(),
  receiptId: z.string().min(1).optional(),
  admittedTickId: z.string().min(1).optional(),
});

const WireAppliedSchema = BufferEvidenceSchema.extend({
  kind: z.literal(EchoTextHostOutcomeKinds.Applied),
  requestId: z.number().int().nonnegative(),
  receiptId: z.string().min(1),
  admittedTickId: z.string().min(1),
});

const CheckpointReasonSchema = z.union([
  z.literal(EchoTextHostCheckpointReasons.ManualSave),
  z.literal(EchoTextHostCheckpointReasons.Autosave),
  z.literal(EchoTextHostCheckpointReasons.RetentionBoundary),
  z.literal(EchoTextHostCheckpointReasons.Export),
  z.literal(EchoTextHostCheckpointReasons.Import),
]);

const WireCheckpointDeclaredSchema = BufferEvidenceSchema.extend({
  kind: z.literal(EchoTextHostOutcomeKinds.CheckpointDeclared),
  requestId: z.number().int().nonnegative(),
  checkpointId: z.string().min(1),
  basisHeadId: z.string().min(1),
  basisByteLength: z.number().int().nonnegative(),
  reason: CheckpointReasonSchema,
  receiptId: z.string().min(1),
  admittedTickId: z.string().min(1),
});

const WindowLineSchema = z.object({
  lineNumber: z.number().int().nonnegative(),
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
  text: z.string(),
});

const WindowSupportSchema = z.object({
  leafId: z.string().min(1),
  blobId: z.string().min(1),
  contentHash: z.string().min(1),
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
});

const WireObservedSchema = z.object({
  kind: z.literal(EchoTextHostOutcomeKinds.Observed),
  requestId: z.number().int().nonnegative(),
  worldlineId: z.string().min(1),
  readingId: z.string().min(1),
  observerPlanId: z.string().min(1),
  packageArtifactHash: z.string().min(1),
  bufferId: z.string().min(1),
  basisHeadId: z.string().min(1),
  rootNodeId: z.string().nullable(),
  byteLength: z.number().int().nonnegative(),
  lineCount: z.number().int().positive(),
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
  text: z.string(),
  lines: z.array(WindowLineSchema),
  support: z.array(WindowSupportSchema),
  resolvedWorldlineTick: z.number().int().nonnegative(),
  commitHash: z.string().min(1),
});

const WireObstructedSchema = z.object({
  kind: z.literal(EchoTextHostOutcomeKinds.Obstructed),
  requestId: z.number().int().nonnegative(),
  code: z.string().min(1),
  message: z.string().min(1),
});

const WireResponseSchema = z.discriminatedUnion('kind', [
  WireOpenedSchema,
  WireAppliedSchema,
  WireCheckpointDeclaredSchema,
  WireObservedSchema,
  WireObstructedSchema,
]);

type WireResponse = z.infer<typeof WireResponseSchema>;

interface PendingRequest {
  readonly resolve: (response: WireResponse) => void;
}

export interface EchoTextContractHostProcessOptions {
  readonly binaryPath?: string;
  readonly cwd?: string;
  readonly walDirectory?: string;
}

class EchoTextContractHostProcess implements EchoTextContractHostPort {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #pending = new Map<number, PendingRequest>();
  #nextRequestId = 1;
  #terminalError: string | null = null;
  #stderr = '';

  constructor(options: EchoTextContractHostProcessOptions) {
    const cwd = options.cwd ?? process.cwd();
    const binaryPath = options.binaryPath
      ?? process.env[HOST_BINARY_ENV]
      ?? path.resolve(cwd, DEFAULT_HOST_BINARY);
    this.#child = spawn(binaryPath, [], {
      cwd,
      env: {
        ...process.env,
        ...(options.walDirectory == null
          ? {}
          : { [HOST_WAL_DIRECTORY_ENV]: options.walDirectory }),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    createInterface({ input: this.#child.stdout }).on('line', (line) => this.#receive(line));
    this.#child.stderr.setEncoding('utf8');
    this.#child.stderr.on('data', (chunk: string) => {
      this.#stderr = `${this.#stderr}${chunk}`.slice(-STDERR_LIMIT);
    });
    this.#child.on('error', (error) => this.#fail(`Echo host process failed: ${error.message}`));
    this.#child.on('exit', (code, signal) => {
      const detail = this.#stderr.trim();
      this.#fail(
        `Echo host exited (code=${String(code)}, signal=${String(signal)})${detail.length === 0 ? '' : `: ${detail}`}`,
      );
    });
    process.once('exit', () => this.#child.kill());
  }

  async openBuffer(request: EchoTextHostOpenRequest): Promise<EchoTextHostOpenOutcome> {
    const response = await this.#send({ kind: 'open', ...request });
    if (response.kind === EchoTextHostOutcomeKinds.Opened) {
      const { requestId: _requestId, ...outcome } = response;
      return outcome;
    }
    return response.kind === EchoTextHostOutcomeKinds.Obstructed
      ? withoutRequestId(response)
      : protocolObstruction('Echo host returned the wrong outcome for openBuffer');
  }

  async replaceRange(request: EchoTextHostReplaceRequest): Promise<EchoTextHostReplaceOutcome> {
    const response = await this.#send({ kind: 'replace', ...request });
    if (response.kind === EchoTextHostOutcomeKinds.Applied) {
      const { requestId: _requestId, ...outcome } = response;
      return outcome;
    }
    return response.kind === EchoTextHostOutcomeKinds.Obstructed
      ? withoutRequestId(response)
      : protocolObstruction('Echo host returned the wrong outcome for replaceRange');
  }

  async declareCheckpoint(
    request: EchoTextHostCheckpointRequest,
  ): Promise<EchoTextHostCheckpointOutcome> {
    const response = await this.#send({ kind: 'declare-checkpoint', ...request });
    if (response.kind === EchoTextHostOutcomeKinds.CheckpointDeclared) {
      const { requestId: _requestId, ...outcome } = response;
      return outcome;
    }
    return response.kind === EchoTextHostOutcomeKinds.Obstructed
      ? withoutRequestId(response)
      : protocolObstruction('Echo host returned the wrong outcome for declareCheckpoint');
  }

  async observeWindow(request: EchoTextHostObserveRequest): Promise<EchoTextHostObserveOutcome> {
    const response = await this.#send({ kind: 'observe', ...request });
    if (response.kind === EchoTextHostOutcomeKinds.Observed) {
      const { requestId: _requestId, ...outcome } = response;
      return outcome;
    }
    return response.kind === EchoTextHostOutcomeKinds.Obstructed
      ? withoutRequestId(response)
      : protocolObstruction('Echo host returned the wrong outcome for observeWindow');
  }

  async close(): Promise<void> {
    if (this.#child.exitCode != null || this.#child.signalCode != null) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.#child.once('exit', () => resolve());
      this.#child.stdin.end();
    });
  }

  #send(request: object): Promise<WireResponse> {
    const requestId = this.#nextRequestId;
    this.#nextRequestId += 1;
    if (this.#terminalError != null) {
      return Promise.resolve(wireObstruction(requestId, HOST_UNAVAILABLE_CODE, this.#terminalError));
    }
    return new Promise((resolve) => {
      this.#pending.set(requestId, { resolve });
      this.#child.stdin.write(`${JSON.stringify({ ...request, requestId })}\n`, (error) => {
        if (error != null) {
          this.#resolveObstructed(requestId, HOST_UNAVAILABLE_CODE, error.message);
        }
      });
    });
  }

  #receive(line: string): void {
    let parsed;
    try {
      parsed = WireResponseSchema.safeParse(JSON.parse(line));
    } catch (cause) {
      this.#fail(`Echo host emitted invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }
    if (!parsed.success) {
      this.#fail(`Echo host emitted an invalid response: ${parsed.error.message}`);
      return;
    }
    const pending = this.#pending.get(parsed.data.requestId);
    if (pending == null) {
      this.#fail(`Echo host emitted an uncorrelated response ${parsed.data.requestId}`);
      return;
    }
    this.#pending.delete(parsed.data.requestId);
    pending.resolve(parsed.data);
  }

  #resolveObstructed(requestId: number, code: string, message: string): void {
    const pending = this.#pending.get(requestId);
    if (pending == null) {
      return;
    }
    this.#pending.delete(requestId);
    pending.resolve(wireObstruction(requestId, code, message));
  }

  #fail(message: string): void {
    if (this.#terminalError == null) {
      this.#terminalError = message;
    }
    for (const requestId of [...this.#pending.keys()]) {
      this.#resolveObstructed(requestId, HOST_UNAVAILABLE_CODE, this.#terminalError);
    }
  }
}

export function createEchoTextContractHostProcess(
  options: EchoTextContractHostProcessOptions = {},
): EchoTextContractHostPort {
  return new EchoTextContractHostProcess(options);
}

function withoutRequestId(response: z.infer<typeof WireObstructedSchema>) {
  const { requestId: _requestId, ...outcome } = response;
  return outcome;
}

function protocolObstruction(message: string) {
  return {
    kind: EchoTextHostOutcomeKinds.Obstructed,
    code: HOST_PROTOCOL_CODE,
    message,
  } as const;
}

function wireObstruction(requestId: number, code: string, message: string): WireResponse {
  return {
    kind: EchoTextHostOutcomeKinds.Obstructed,
    requestId,
    code,
    message,
  };
}
