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
}

export class EchoKernelTransportError extends Error {
  public readonly operation: string;

  public constructor(operation: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EchoKernelTransportError';
    this.operation = operation;
  }
}
