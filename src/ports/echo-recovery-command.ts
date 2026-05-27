export const ECHO_RECOVERY_COMMAND_EXITED = 'ECHO_RECOVERY_COMMAND_EXITED';

export interface EchoRecoveryCommandRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly timeoutMs?: number;
}

export interface EchoRecoveryCommandResult {
  readonly status: typeof ECHO_RECOVERY_COMMAND_EXITED;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface EchoRecoveryCommandPort {
  run(request: EchoRecoveryCommandRequest): Promise<EchoRecoveryCommandResult>;
}
