import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const PORT_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'source-highlighter.js');
const WINDOW_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'source-window.js');
const HIGHLIGHT_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'source-highlight.js');

async function loadSourceHighlightModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    port: await import(pathToFileURL(PORT_PATH).href),
    sourceWindow: await import(pathToFileURL(WINDOW_PATH).href),
    sourceHighlight: await import(pathToFileURL(HIGHLIGHT_PATH).href),
  };
}

function fakeTheme() {
  return {
    semantic: {
      success: { hex: '#00ff00', fgRGB: [0, 255, 0] },
      error: { hex: '#ff0000', fgRGB: [255, 0, 0] },
      warning: { hex: '#ffaa00', fgRGB: [255, 170, 0] },
      info: { hex: '#00aaff', fgRGB: [0, 170, 255] },
      accent: { hex: '#ff00aa', fgRGB: [255, 0, 170] },
      muted: { hex: '#888888', fgRGB: [136, 136, 136] },
      primary: { hex: '#ffffff', fgRGB: [255, 255, 255] },
    },
    surface: {
      elevated: { hex: '#ffffff', bg: '#333333', fgRGB: [255, 255, 255], bgRGB: [51, 51, 51] },
    },
  };
}

test('source highlight painter applies Bijou token styles to Graft-derived spans', async () => {
  const { createSurface } = await import('@flyingrobots/bijou');
  const { port, sourceWindow, sourceHighlight } = await loadSourceHighlightModules();
  const surface = createSurface(24, 2, { char: ' ', empty: false });
  const reading = sourceWindow.createSourceWindowReadingFromLines({
    lines: [
      'const answer = "ok";',
      '// quiet',
    ],
    startLine: 0,
    lineCount: 2,
  });

  sourceHighlight.paintHighlightedSourceWindow(
    surface,
    reading,
    {
      path: 'src/app.ts',
      partial: false,
      spans: [
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.Keyword,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 5 } },
        },
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.String,
          range: { start: { row: 0, column: 15 }, end: { row: 0, column: 19 } },
        },
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.Comment,
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 8 } },
        },
      ],
    },
    {
      x: 0,
      y: 0,
      scrollCol: 0,
      width: 24,
      height: 2,
      theme: fakeTheme(),
    },
  );

  const keywordCell = surface.get(0, 0);
  assert.equal(keywordCell.char, 'c');
  assert.equal(keywordCell.fg, '#ff00aa');
  assert.deepEqual(keywordCell.modifiers, ['bold']);

  const stringCell = surface.get(15, 0);
  assert.equal(stringCell.char, '"');
  assert.equal(stringCell.fg, '#00aaff');

  const commentCell = surface.get(0, 1);
  assert.equal(commentCell.char, '/');
  assert.equal(commentCell.fg, '#888888');
  assert.deepEqual(commentCell.modifiers, ['dim']);
});
