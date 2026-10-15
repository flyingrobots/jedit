import { mkdtempSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initDefaultContext } from '@flyingrobots/bijou-node';
import { getDefaultContext } from '@flyingrobots/bijou';
import { run } from '@flyingrobots/bijou-tui';
import { workspaceTerminalIO } from '../dist/adapters/workspace-terminal-io.js';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from '../dist/ui/terminal-mouse.js';
import { createWorkspaceApp } from '../dist/adapters/workspace-app.js';
import { createWorkspaceProductionTextDependencies, closingProductionText } from '../dist/adapters/workspace-production-text-dependencies.js';
import { createInitialModelSnapshot } from '../dist/adapters/workspace-initial-model-snapshot.js';
import { createFooterPreferences } from '../dist/adapters/footer-preferences.js';
import { BijouI18nAdapter } from '../dist/adapters/bijou-i18n-adapter.js';
import { oppositeJeditTheme } from '../dist/ui/jedit-themes.js';

const directory = realpathSync(mkdtempSync(join(tmpdir(), 'jim-dojo-feed-')));
writeFileSync('/tmp/jim-dojo-feed-witness-directory.txt', directory);
writeFileSync(join(directory, 'example.txt'), 'Dojo Feed witness\nThis is synthetic local fixture text.\n');
process.env.JEDIT_ECHO_WAL_DIR = join(directory, 'wal');
process.env.TERM = 'xterm-256color';
for (const name of ['NO_COLOR', 'CI', 'BIJOU_ACCESSIBLE']) delete process.env[name];
initDefaultContext();
const seed = createInitialModelSnapshot(Date.now(), directory);
seed.i18n = new BijouI18nAdapter(process.env.DOJO_FEED_WITNESS_LOCALE ?? 'en');
if (process.env.DOJO_FEED_WITNESS_LIGHT === '1') seed.jeditTheme = oppositeJeditTheme(seed.jeditTheme);
const production = await createWorkspaceProductionTextDependencies();
await closingProductionText(production, async () => {
  const app = createWorkspaceApp({ initialColumns: process.stdout.columns, initialRows: process.stdout.rows,
    initialWorkingDirectory: directory, perfEnabled: false, seed,
    footerPreferences: createFooterPreferences(join(directory, '.jimrc')) }, production);
  const update = app.update;
  const history = [];
  app.update = (message, model) => {
    const result = update(message, model);
    if (message.type !== 'key' && message.type !== 'mouse') return result;
    const next = result[0];
    const surface = app.view(next);
    const cells = Array.from({ length: surface.height }, (_, y) =>
      Array.from({ length: surface.width }, (_, x) => surface.get(x, y)));
    history.push({ message, drawer: next.dojoFeedDrawer, focus: next.focusPane, selected: next.selectedIndex,
      editor: next.editor, commands: result[1].length, locale: next.i18n.locale });
    writeFileSync(join(directory, 'events.json'), JSON.stringify(history, null, 2));
    writeFileSync(join(directory, `frame-${history.length}.json`), JSON.stringify(cells));
    return result;
  };
  const context = getDefaultContext();
  await run(app, { ...JEDIT_TERMINAL_MOUSE_OPTIONS, ctx: { ...context, io: workspaceTerminalIO(context.io) } });
});
