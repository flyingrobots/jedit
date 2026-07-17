import {
  createEchoObstructedProductionTextSession,
  type ProductionTextSession,
} from '../app/workspace/production-text-session.js';
import type { EchoWasmKernelTransport } from '../ports/echo-kernel-transport.js';

const GENERATED_OPERATION_CORRIDOR_RECOVERY = 'Install the generated Jim Edict package in the Echo host.';

export function createWorkspaceProductionTextSession(
  transport: EchoWasmKernelTransport,
): ProductionTextSession {
  const kernel = transport.kernelInfo();
  return createEchoObstructedProductionTextSession(
    `Echo kernel ${kernel.moduleSpecifier} is initialized. ${GENERATED_OPERATION_CORRIDOR_RECOVERY}`,
  );
}
