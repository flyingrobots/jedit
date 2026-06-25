export const JEDIT_STARTUP_CLI_PRINT = 'print';

export interface JeditStartupCliPrintAction {
  readonly kind: typeof JEDIT_STARTUP_CLI_PRINT;
  readonly text: string;
}

export type JeditStartupCliAction = JeditStartupCliPrintAction;

export function jeditStartupPrintAction(text: string): JeditStartupCliPrintAction {
  return {
    kind: JEDIT_STARTUP_CLI_PRINT,
    text,
  };
}
