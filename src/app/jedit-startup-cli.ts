import { jeditPackageVersionLine } from './jedit-package-identity.js';

export const JEDIT_STARTUP_CLI_PRINT = 'print';

const VERSION_FLAG_LONG = '--version';
const VERSION_FLAG_SHORT = '-V';
const HELP_FLAG_LONG = '--help';
const HELP_FLAG_SHORT = '-h';
const SINGLE_FLAG_ARG_COUNT = 1;

export interface JeditStartupCliPrintAction {
  readonly kind: typeof JEDIT_STARTUP_CLI_PRINT;
  readonly text: string;
}

export type JeditStartupCliAction = JeditStartupCliPrintAction;

export function jeditStartupCliAction(args: readonly string[]): JeditStartupCliAction | null {
  if (args.length !== SINGLE_FLAG_ARG_COUNT) {
    return null;
  }

  const flag = args[0];
  if (flag === VERSION_FLAG_LONG || flag === VERSION_FLAG_SHORT) {
    return printAction(`${jeditPackageVersionLine()}\n`);
  }
  if (flag === HELP_FLAG_LONG || flag === HELP_FLAG_SHORT) {
    return printAction(jeditStartupHelpText());
  }
  return null;
}

export function jeditStartupHelpText(): string {
  return `${jeditPackageVersionLine()}

Usage: jedit [--version|-V] [--help|-h]

Options:
  -V, --version  Print the jedit package version.
  -h, --help     Show this help.
`;
}

function printAction(text: string): JeditStartupCliPrintAction {
  return {
    kind: JEDIT_STARTUP_CLI_PRINT,
    text,
  };
}
