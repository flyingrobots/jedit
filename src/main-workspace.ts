import { initDefaultContext } from '@flyingrobots/bijou-node';
import { run } from '@flyingrobots/bijou-tui';
import { createWorkspaceApp } from './adapters/workspace-app.js';
import { closingProductionText, createWorkspaceProductionTextDependencies } from './adapters/workspace-production-text-dependencies.js';
import { parseTextRuntimeProfile, requireTextRuntimeProfile } from './app/text-runtime-profile.js';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from './ui/terminal-mouse.js';

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

export const WORKSPACE_INSTRUMENTATION_ENV = Object.freeze({
  Perf: ENV_KEYS.Perf,
  Profile: ENV_KEYS.Profile,
});

export interface WorkspaceInstrumentation {
  readonly perfEnabled: boolean;
  readonly profileEnabled: boolean;
}

// Both default off. The perf overlay rebuilds three surfaces every frame, and
// the profiler opens .jedit/perf-session.jsonl and appends a frame record per
// tick -- a measured 268 KB of disk writes over a 22 second idle session.
// Neither belongs on a launch nobody asked to instrument.
export function workspaceInstrumentationFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): WorkspaceInstrumentation {
  return {
    perfEnabled: envBoolean(env[ENV_KEYS.Perf], { defaultValue: false }),
    profileEnabled: envBoolean(env[ENV_KEYS.Profile], { defaultValue: false }),
  };
}

export async function runJeditWorkspace(): Promise<void> {
  requireTextRuntimeProfile(parseTextRuntimeProfile(
    process.env[ENV_KEYS.TextRuntime],
  ));

  initDefaultContext();

  const productionText = await createWorkspaceProductionTextDependencies();

  // `run` resolves when the TUI tears down. It was not awaited, so this
  // function returned while the editor was still live and the shutdown below
  // could never happen. Closing the native Echo host releases the child stdio
  // pipes that were holding the event loop open after quit.
  //
  // App construction is inside the guard, not before it: it can throw, and when
  // it did the host was left open and the terminal unrestored.
  await closingProductionText(productionText, async () => {
    const app = createWorkspaceApp({
      initialColumns: process.stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
      initialRows: process.stdout.rows ?? DEFAULT_TERMINAL_ROWS,
      initialWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
      ...workspaceInstrumentationFromEnv(process.env),
    }, productionText);
    await run(app, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS.mouse });
  });
}

function envBoolean(
  value: string | undefined,
  options: EnvBooleanOptions,
): boolean {
  return BOOLEAN_BY_ENV_VALUE[value ?? ''] ?? options.defaultValue;
}
