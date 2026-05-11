import { initDefaultContext } from '@flyingrobots/bijou-node';
import { run } from '@flyingrobots/bijou-tui';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from './ui/terminal-mouse.js';
import { createWorkspaceApp } from './adapters/workspace-app.js';

initDefaultContext();

const app = createWorkspaceApp({
  initialColumns: process.stdout.columns ?? 100,
  initialRows: process.stdout.rows ?? 32,
  initialWorkingDirectory: process.cwd(),
  perfEnabled: process.env.JEDIT_PERF === '1',
});

run(app, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS });
