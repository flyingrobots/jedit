import {
  EchoKernelTransportError,
  type EchoKernelInfo,
  type EchoTrustedHostControlTransport,
  type EchoWasmKernelHostTransport,
  type EchoWasmKernelTransport,
} from '../ports/echo-kernel-transport.js';

const DEFAULT_ECHO_WASM_MODULE = 'warp-wasm';
const OPERATION_MODULE_BOOTSTRAP = 'module-bootstrap';
const OPERATION_KERNEL_INIT = 'kernel-init';
const OPERATION_DISPATCH_INTENT = 'dispatch_intent';
const OPERATION_DISPATCH_CONTROL_INTENT_TRUSTED = 'dispatch_control_intent_trusted';
const OPERATION_OBSERVE = 'observe';
const OPERATION_SCHEDULER_STATUS = 'scheduler_status';
const OPERATION_GET_CODEC_ID = 'get_codec_id';
const OPERATION_GET_REGISTRY_VERSION = 'get_registry_version';
const OPERATION_GET_SCHEMA_SHA256_HEX = 'get_schema_sha256_hex';

interface EchoWasmKernelModule {
  readonly default?: (() => Promise<void>) | (() => void);
  readonly init?: () => Uint8Array;
  readonly dispatch_intent?: (intentBytes: Uint8Array) => Uint8Array;
  readonly dispatch_control_intent_trusted?: (controlIntentBytes: Uint8Array) => Uint8Array;
  readonly observe?: (requestBytes: Uint8Array) => Uint8Array;
  readonly scheduler_status?: () => Uint8Array;
  readonly get_codec_id?: () => string | null | undefined;
  readonly get_registry_version?: () => string | null | undefined;
  readonly get_schema_sha256_hex?: () => string | null | undefined;
}

type BytePayloadMethod = (bytes: Uint8Array) => Uint8Array;

export interface CreateEchoWasmKernelTransportOptions {
  readonly moduleSpecifier?: string;
  readonly moduleLoader?: (moduleSpecifier: string) => Promise<EchoWasmKernelModule>;
  readonly bootstrapModule?: boolean;
  readonly initializeKernel?: boolean;
}

interface InstalledEchoWasmKernel {
  readonly moduleSpecifier: string;
  readonly kernelModule: EchoWasmKernelModule;
  readonly info: EchoKernelInfo;
}

export async function createEchoWasmKernelTransport(
  options: CreateEchoWasmKernelTransportOptions = {},
): Promise<EchoWasmKernelTransport> {
  return createAppTransport(await installEchoWasmKernel(options));
}

export async function createEchoWasmKernelHostTransport(
  options: CreateEchoWasmKernelTransportOptions = {},
): Promise<EchoWasmKernelHostTransport> {
  const installed = await installEchoWasmKernel(options);
  const trustedDispatch = requireBytePayloadMethod(
    installed.kernelModule.dispatch_control_intent_trusted,
    OPERATION_DISPATCH_CONTROL_INTENT_TRUSTED,
  );

  return {
    app: createAppTransport(installed),
    trustedHost: createTrustedHostTransport(trustedDispatch),
  };
}

async function installEchoWasmKernel(
  options: CreateEchoWasmKernelTransportOptions,
): Promise<InstalledEchoWasmKernel> {
  const moduleSpecifier = options.moduleSpecifier ?? DEFAULT_ECHO_WASM_MODULE;
  const moduleLoader = options.moduleLoader ?? defaultModuleLoader;
  const bootstrapModule = options.bootstrapModule ?? true;
  const initializeKernel = options.initializeKernel ?? true;

  const kernelModule = await moduleLoader(moduleSpecifier);

  if (bootstrapModule) {
    await bootstrapEchoWasmModule(kernelModule);
  }

  if (initializeKernel) {
    invokeKernelInit(kernelModule);
  }

  const info = toEchoKernelInfo(moduleSpecifier, kernelModule);

  return {
    moduleSpecifier,
    kernelModule,
    info,
  };
}

function createAppTransport(installed: InstalledEchoWasmKernel): EchoWasmKernelTransport {
  const kernelModule = installed.kernelModule;
  const info = installed.info;

  return {
    kernelInfo() {
      return info;
    },
    submitIntentBytes(intentBytes) {
      return invokeRequiredBytePayloadMethod(
        kernelModule.dispatch_intent,
        OPERATION_DISPATCH_INTENT,
        intentBytes,
      );
    },
    observeBytes(requestBytes) {
      return invokeRequiredBytePayloadMethod(kernelModule.observe, OPERATION_OBSERVE, requestBytes);
    },
    schedulerStatusBytes() {
      return invokeRequiredZeroArgBytesMethod(kernelModule.scheduler_status, OPERATION_SCHEDULER_STATUS);
    },
  };
}

function createTrustedHostTransport(trustedDispatch: BytePayloadMethod): EchoTrustedHostControlTransport {
  return {
    dispatchControlIntentBytes(controlIntentBytes) {
      return invokeRequiredBytePayloadMethod(
        trustedDispatch,
        OPERATION_DISPATCH_CONTROL_INTENT_TRUSTED,
        controlIntentBytes,
      );
    },
  };
}

async function defaultModuleLoader(moduleSpecifier: string): Promise<EchoWasmKernelModule> {
  return import(moduleSpecifier);
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
      OPERATION_MODULE_BOOTSTRAP,
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
      OPERATION_KERNEL_INIT,
      'Echo kernel initialization failed',
      { cause: error },
    );
  }
}

function toEchoKernelInfo(moduleSpecifier: string, kernelModule: EchoWasmKernelModule): EchoKernelInfo {
  return {
    moduleSpecifier,
    codecId: invokeOptionalStringMethod(kernelModule.get_codec_id, OPERATION_GET_CODEC_ID),
    registryVersion: invokeOptionalStringMethod(kernelModule.get_registry_version, OPERATION_GET_REGISTRY_VERSION),
    schemaSha256Hex: invokeOptionalStringMethod(kernelModule.get_schema_sha256_hex, OPERATION_GET_SCHEMA_SHA256_HEX),
  };
}

function requireBytePayloadMethod(
  fn: BytePayloadMethod | undefined,
  operation: string,
): BytePayloadMethod {
  if (typeof fn !== 'function') {
    throw new EchoKernelTransportError(
      operation,
      `Echo wasm module does not expose ${operation}`,
    );
  }
  return fn;
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
