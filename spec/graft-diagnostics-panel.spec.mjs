import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const PANEL_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'graft-diagnostics-panel.js');
const PORT_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'graft-diagnostics.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');

async function loadPanelModules() {
  await ensureDistBuilt();

  return {
    panel: await import(pathToFileURL(PANEL_PATH).href),
    port: await import(pathToFileURL(PORT_PATH).href),
    themes: await import(pathToFileURL(THEMES_PATH).href),
  };
}

function surfaceText(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')
  )).join('\n');
}

test('Graft diagnostics panel renders runtime facts and loading posture', async () => {
  const { panel, port, themes } = await loadPanelModules();
  const theme = themes.availableJeditThemes()[0];
  const report = {
    title: 'Graft diagnostics',
    summary: 'Colorful prose projection is active.',
    rows: [
      {
        label: 'Graft',
        value: '0.10.0',
        status: port.GRAFT_DIAGNOSTIC_STATUS.Ok,
      },
      {
        label: 'Colorful CLI',
        value: '0.2.1',
        detail: 'command: colorful',
        status: port.GRAFT_DIAGNOSTIC_STATUS.Ok,
      },
      {
        label: 'Parser',
        value: 'cold',
        detail: 'ensureParserReady() runs before projection.',
        status: port.GRAFT_DIAGNOSTIC_STATUS.Warning,
      },
    ],
  };

  const surface = panel.renderGraftDiagnosticsPanel({
    report,
    loading: true,
    theme,
    width: 50,
    height: 18,
  });
  const text = surfaceText(surface);

  assert.match(text, /Graft diagnostics/);
  assert.match(text, /F2 close · Esc back · Enter refresh/);
  assert.match(text, /loading/);
  assert.match(text, /ok Graft: 0\.10\.0/);
  assert.match(text, /ok Colorful CLI: 0\.2\.1/);
  assert.match(text, /command: colorful/);
  assert.match(text, /warn Parser: cold/);
});
