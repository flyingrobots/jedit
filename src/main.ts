import { writeSync } from 'node:fs';
import { jeditStartupCliAction } from './adapters/jedit-startup-cli.js';

const STDOUT_FILE_DESCRIPTOR = 1;

const startupCliAction = jeditStartupCliAction(process.argv.slice(2));
if (startupCliAction != null) {
  writeSync(STDOUT_FILE_DESCRIPTOR, startupCliAction.text);
} else {
  const { runJeditWorkspace } = await import('./main-workspace.js');
  await runJeditWorkspace();
}
