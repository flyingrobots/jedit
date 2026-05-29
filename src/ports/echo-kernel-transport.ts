import type { JeditWorldlineSessionPort } from './jedit-worldline-session-port.js';

export interface EchoKernelInfo {
  readonly moduleSpecifier: string;
  readonly codecId?: string;
  readonly registryVersion?: string;
  readonly schemaSha256Hex?: string;
}

export interface EchoWasmKernelTransport {
  kernelInfo(): EchoKernelInfo;
  submitIntentBytes(intentBytes: Uint8Array): Uint8Array;
  observeBytes(requestBytes: Uint8Array): Uint8Array;
  schedulerStatusBytes(): Uint8Array;
  /**
   * In-process transports that resolve worldline sessions before dispatch
   * expose the session port here so the optic client can register sessions
   * on the same instance the transport reads from. Undefined for transports
   * that don't perform in-process session resolution (real WASM kernel).
   */
  readonly jeditSessionPort?: JeditWorldlineSessionPort;
}

export interface EchoTrustedHostControlTransport {
  dispatchControlIntentBytes(controlIntentBytes: Uint8Array): Uint8Array;
}

export interface EchoWasmKernelHostTransport {
  readonly app: EchoWasmKernelTransport;
  readonly trustedHost: EchoTrustedHostControlTransport;
}

export class EchoKernelTransportError extends Error {
  public readonly operation: string;

  public constructor(operation: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EchoKernelTransportError';
    this.operation = operation;
  }
}
