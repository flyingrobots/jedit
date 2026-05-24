import { initDefaultContext } from '@flyingrobots/bijou-node';
import { run } from '@flyingrobots/bijou-tui';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from './ui/terminal-mouse.js';
import { createWorkspaceApp } from './adapters/workspace-app.js';
import { parseInteractiveTextRuntimeMode } from './app/interactive-text-runtime-mode.js';

const DEFAULT_TERMINAL_COLUMNS = 100;
const DEFAULT_TERMINAL_ROWS = 32;
const DEFAULT_WORKING_DIRECTORY = process.cwd();
const ENV_KEYS = Object.freeze({
  TextRuntime: 'JEDIT_TEXT_RUNTIME',
  Perf: 'JEDIT_PERF',
} as const);
const ENV_BOOLEAN = Object.freeze({
  Enabled: '1',
  Disabled: '0',
} as const);
const BOOLEAN_BY_ENV_VALUE: Readonly<Record<string, boolean>> = Object.freeze({
  [ENV_BOOLEAN.Enabled]: true,
  [ENV_BOOLEAN.Disabled]: false,
});

initDefaultContext();

const interactiveTextRuntimeMode = parseInteractiveTextRuntimeMode(
  process.env[ENV_KEYS.TextRuntime],
);

const app = createWorkspaceApp({
  initialColumns: process.stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
  initialRows: process.stdout.rows ?? DEFAULT_TERMINAL_ROWS,
  initialWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
  interactiveTextRuntimeMode,
  perfEnabled: envBoolean(process.env[ENV_KEYS.Perf]),
});

run(app, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS.mouse });

function envBoolean(value: string | undefined): boolean {
  return BOOLEAN_BY_ENV_VALUE[value ?? ENV_BOOLEAN.Disabled] ?? false;
}
