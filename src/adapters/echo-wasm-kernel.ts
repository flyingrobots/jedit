import {
  EchoKernelTransportError,
  type EchoKernelInfo,
  type EchoWasmKernelTransport,
} from '../ports/echo-kernel-transport.js';

const DEFAULT_ECHO_WASM_MODULE = 'warp-wasm';

interface EchoWasmKernelModule {
  readonly default?: (() => Promise<void>) | (() => void);
  readonly init?: () => Uint8Array;
  readonly dispatch_intent?: (intentBytes: Uint8Array) => Uint8Array;
  readonly observe?: (requestBytes: Uint8Array) => Uint8Array;
  readonly scheduler_status?: () => Uint8Array;
  readonly get_codec_id?: () => string | null | undefined;
  readonly get_registry_version?: () => string | null | undefined;
  readonly get_schema_sha256_hex?: () => string | null | undefined;
}

export interface CreateEchoWasmKernelTransportOptions {
  readonly moduleSpecifier?: string;
  readonly moduleLoader?: (moduleSpecifier: string) => Promise<object>;
  readonly bootstrapModule?: boolean;
  readonly initializeKernel?: boolean;
}

export async function createEchoWasmKernelTransport(
  options: CreateEchoWasmKernelTransportOptions = {},
): Promise<EchoWasmKernelTransport> {
  const moduleSpecifier = options.moduleSpecifier ?? DEFAULT_ECHO_WASM_MODULE;
  const moduleLoader = options.moduleLoader ?? defaultModuleLoader;
  const bootstrapModule = options.bootstrapModule ?? true;
  const initializeKernel = options.initializeKernel ?? true;

  const rawModule = await moduleLoader(moduleSpecifier);
  const kernelModule = toEchoWasmKernelModule(rawModule);

  if (bootstrapModule) {
    await bootstrapEchoWasmModule(kernelModule);
  }

  if (initializeKernel) {
    invokeKernelInit(kernelModule);
  }

  const info = toEchoKernelInfo(moduleSpecifier, kernelModule);

  return {
    kernelInfo() {
      return info;
    },
    submitIntentBytes(intentBytes) {
      return invokeRequiredBytePayloadMethod(kernelModule.dispatch_intent, 'dispatch_intent', intentBytes);
    },
    observeBytes(requestBytes) {
      return invokeRequiredBytePayloadMethod(kernelModule.observe, 'observe', requestBytes);
    },
    schedulerStatusBytes() {
      return invokeRequiredZeroArgBytesMethod(kernelModule.scheduler_status, 'scheduler_status');
    },
  };
}

async function defaultModuleLoader(moduleSpecifier: string): Promise<object> {
  return import(moduleSpecifier) as Promise<object>;
}

function toEchoWasmKernelModule(rawModule: object): EchoWasmKernelModule {
  return rawModule as EchoWasmKernelModule;
}

async function bootstrapEchoWasmModule(kernelModule: EchoWasmKernelModule): Promise<void> {
  const bootstrap = kernelModule.default;
  if (typeof bootstrap !== 'function') {
    return;
  }

  try {
    await bootstrap();
  } catch (error) {
    throw new EchoKernelTransportError(
      'module-bootstrap',
      'Echo wasm module bootstrap failed',
      { cause: error },
    );
  }
}

function invokeKernelInit(kernelModule: EchoWasmKernelModule): void {
  if (typeof kernelModule.init !== 'function') {
    return;
  }

  try {
    kernelModule.init();
  } catch (error) {
    throw new EchoKernelTransportError(
      'kernel-init',
      'Echo kernel initialization failed',
      { cause: error },
    );
  }
}

function toEchoKernelInfo(moduleSpecifier: string, kernelModule: EchoWasmKernelModule): EchoKernelInfo {
  return {
    moduleSpecifier,
    codecId: invokeOptionalStringMethod(kernelModule.get_codec_id, 'get_codec_id'),
    registryVersion: invokeOptionalStringMethod(kernelModule.get_registry_version, 'get_registry_version'),
    schemaSha256Hex: invokeOptionalStringMethod(kernelModule.get_schema_sha256_hex, 'get_schema_sha256_hex'),
  };
}

function invokeOptionalStringMethod(
  fn: (() => string | null | undefined) | undefined,
  operation: string,
): string | undefined {
  if (typeof fn !== 'function') {
    return undefined;
  }

  try {
    return fn() ?? undefined;
  } catch (error) {
    throw new EchoKernelTransportError(
      operation,
      `Echo wasm metadata call ${operation} failed`,
      { cause: error },
    );
  }
}

function invokeRequiredBytePayloadMethod(
  fn: ((bytes: Uint8Array) => Uint8Array) | undefined,
  operation: string,
  bytes: Uint8Array,
): Uint8Array {
  if (typeof fn !== 'function') {
    throw new EchoKernelTransportError(
      operation,
      `Echo wasm module does not expose ${operation}`,
    );
  }

  try {
    return fn(bytes);
  } catch (error) {
    throw new EchoKernelTransportError(
      operation,
      `Echo wasm call ${operation} failed`,
      { cause: error },
    );
  }
}

function invokeRequiredZeroArgBytesMethod(
  fn: (() => Uint8Array) | undefined,
  operation: string,
): Uint8Array {
  if (typeof fn !== 'function') {
    throw new EchoKernelTransportError(
      operation,
      `Echo wasm module does not expose ${operation}`,
    );
  }

  try {
    return fn();
  } catch (error) {
    throw new EchoKernelTransportError(
      operation,
      `Echo wasm call ${operation} failed`,
      { cause: error },
    );
  }
}
