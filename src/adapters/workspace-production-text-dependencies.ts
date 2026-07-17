import type { ProductionTextSession } from '../app/workspace/production-text-session.js';
import { createEchoWasmKernelTransport } from './echo-wasm-kernel.js';
import { createWorkspaceProductionTextSession } from './workspace-production-text-session.js';

const DEFAULT_JEDIT_ECHO_WASM_MODULE = '@flyingrobots/jedit-echo-wasm';
const JEDIT_ECHO_WASM_MODULE_ENV = 'JEDIT_ECHO_WASM_MODULE';

export interface WorkspaceProductionTextDependencies {
  readonly productionTextSession: ProductionTextSession;
}

export async function createWorkspaceProductionTextDependencies(): Promise<WorkspaceProductionTextDependencies> {
  const echo = await createEchoWasmKernelTransport({
    moduleSpecifier: process.env[JEDIT_ECHO_WASM_MODULE_ENV] ?? DEFAULT_JEDIT_ECHO_WASM_MODULE,
  });
  return {
    productionTextSession: createWorkspaceProductionTextSession(echo),
  };
}
