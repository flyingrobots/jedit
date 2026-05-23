import type {
  JeditEchoAgentWitnessPort,
  JeditEchoWitnessRequest,
  JeditEchoWitnessSummary,
} from '../ports/jedit-echo-agent-witness.js';

export const JEDIT_ECHO_WITNESS_MCP_TOOL_NAME = 'jedit_echo_witness';

export interface JeditEchoWitnessMcpRequest extends JeditEchoWitnessRequest {
  readonly dryRun: boolean;
}

export interface JeditEchoWitnessMcpResult {
  readonly toolName: typeof JEDIT_ECHO_WITNESS_MCP_TOOL_NAME;
  readonly structuredContent: JeditEchoWitnessSummary;
}

export interface JeditEchoWitnessMcpAdapter {
  call(request: JeditEchoWitnessMcpRequest): Promise<JeditEchoWitnessMcpResult>;
}

export interface JeditEchoWitnessMcpAdapterOptions {
  readonly witness: JeditEchoAgentWitnessPort;
}

export function createJeditEchoWitnessMcpAdapter(
  options: JeditEchoWitnessMcpAdapterOptions,
): JeditEchoWitnessMcpAdapter {
  return {
    async call(request) {
      return {
        toolName: JEDIT_ECHO_WITNESS_MCP_TOOL_NAME,
        structuredContent: request.dryRun
          ? await options.witness.dryRun(request)
          : await options.witness.run(request),
      };
    },
  };
}
