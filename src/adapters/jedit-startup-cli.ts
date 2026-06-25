import {
  JEDIT_STARTUP_CLI_PRINT,
  jeditStartupPrintAction,
  type JeditStartupCliAction,
} from '../app/jedit-startup-cli.js';
import { jeditPackageVersionLine } from './jedit-package-identity.js';

export { JEDIT_STARTUP_CLI_PRINT, type JeditStartupCliAction };

const STARTUP_CLI_SINGLE_ARG_COUNT = 1;
const STARTUP_CLI_USAGE = 'Usage: jedit [--version|-V] [--help|-h]';
const STARTUP_CLI_OPTIONS_HEADER = 'Options:';
const STARTUP_CLI_VERSION_OPTION = '  -V, --version  Print the jedit package version.';
const STARTUP_CLI_HELP_OPTION = '  -h, --help     Show this help.';
const JEDIT_STARTUP_CLI_REQUEST = Object.freeze({
  Version: Symbol('jedit.startup-cli.request.version'),
  Help: Symbol('jedit.startup-cli.request.help'),
} as const);
const STARTUP_CLI_FLAG = Object.freeze({
  VersionLong: '--version',
  VersionShort: '-V',
  HelpLong: '--help',
  HelpShort: '-h',
} as const);
const STARTUP_CLI_REQUEST_BY_FLAG = new Map<string, JeditStartupCliRequest>([
  [STARTUP_CLI_FLAG.VersionLong, JEDIT_STARTUP_CLI_REQUEST.Version],
  [STARTUP_CLI_FLAG.VersionShort, JEDIT_STARTUP_CLI_REQUEST.Version],
  [STARTUP_CLI_FLAG.HelpLong, JEDIT_STARTUP_CLI_REQUEST.Help],
  [STARTUP_CLI_FLAG.HelpShort, JEDIT_STARTUP_CLI_REQUEST.Help],
]);

type JeditStartupCliRequest =
  typeof JEDIT_STARTUP_CLI_REQUEST[keyof typeof JEDIT_STARTUP_CLI_REQUEST];

export function jeditStartupCliAction(args: readonly string[]): JeditStartupCliAction | null {
  if (args.length !== STARTUP_CLI_SINGLE_ARG_COUNT) {
    return null;
  }

  const request = STARTUP_CLI_REQUEST_BY_FLAG.get(args[0] ?? '');
  if (request === JEDIT_STARTUP_CLI_REQUEST.Version) {
    return jeditStartupPrintAction(`${jeditPackageVersionLine()}\n`);
  }
  if (request === JEDIT_STARTUP_CLI_REQUEST.Help) {
    return jeditStartupPrintAction(jeditStartupHelpText());
  }
  return null;
}

function jeditStartupHelpText(): string {
  return `${jeditPackageVersionLine()}

${STARTUP_CLI_USAGE}

${STARTUP_CLI_OPTIONS_HEADER}
${STARTUP_CLI_VERSION_OPTION}
${STARTUP_CLI_HELP_OPTION}
`;
}
