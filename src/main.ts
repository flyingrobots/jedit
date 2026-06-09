import { initDefaultContext } from '@flyingrobots/bijou-node';
import { run } from '@flyingrobots/bijou-tui';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from './ui/terminal-mouse.js';
import { createWorkspaceApp } from './adapters/workspace-app.js';
import { parseTextRuntimeProfile, requireTextRuntimeProfile } from './app/text-runtime-profile.js';

const DEFAULT_TERMINAL_COLUMNS = 100;
const DEFAULT_TERMINAL_ROWS = 32;
const DEFAULT_WORKING_DIRECTORY = process.cwd();
const ENV_KEYS = Object.freeze({
  TextRuntime: 'JEDIT_TEXT_RUNTIME',
  Perf: 'JEDIT_PERF',
  Profile: 'JEDIT_PROFILE',
} as const);
const ENV_BOOLEAN = Object.freeze({
  Enabled: '1',
  Disabled: '0',
} as const);
const BOOLEAN_BY_ENV_VALUE: Readonly<Record<string, boolean>> = Object.freeze({
  [ENV_BOOLEAN.Enabled]: true,
  [ENV_BOOLEAN.Disabled]: false,
});
interface EnvBooleanOptions {
  readonly defaultValue: boolean;
}

requireTextRuntimeProfile(parseTextRuntimeProfile(
  process.env[ENV_KEYS.TextRuntime],
));

initDefaultContext();

const app = createWorkspaceApp({
  initialColumns: process.stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
  initialRows: process.stdout.rows ?? DEFAULT_TERMINAL_ROWS,
  initialWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
  perfEnabled: envBoolean(process.env[ENV_KEYS.Perf], { defaultValue: true }),
  profileEnabled: envBoolean(process.env[ENV_KEYS.Profile], {
    defaultValue: true,
  }),
});

run(app, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS.mouse });

function envBoolean(
  value: string | undefined,
  options: EnvBooleanOptions,
): boolean {
  return BOOLEAN_BY_ENV_VALUE[value ?? ''] ?? options.defaultValue;
}
