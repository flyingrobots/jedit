import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'markdown-preview.js');

async function loadMarkdownPreviewModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
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
    border: {
      primary: { hex: '#ffffff', fgRGB: [255, 255, 255] },
      secondary: { hex: '#cccccc', fgRGB: [204, 204, 204] },
      success: { hex: '#00ff00', fgRGB: [0, 255, 0] },
      warning: { hex: '#ffaa00', fgRGB: [255, 170, 0] },
      error: { hex: '#ff0000', fgRGB: [255, 0, 0] },
      muted: { hex: '#666666', fgRGB: [102, 102, 102] },
    },
    surface: {
      primary: { hex: '#ffffff', bg: '#111111', fgRGB: [255, 255, 255], bgRGB: [17, 17, 17] },
      secondary: { hex: '#ffffff', bg: '#222222', fgRGB: [255, 255, 255], bgRGB: [34, 34, 34] },
      elevated: { hex: '#ffffff', bg: '#333333', fgRGB: [255, 255, 255], bgRGB: [51, 51, 51] },
      overlay: { hex: '#ffffff', bg: '#444444', fgRGB: [255, 255, 255], bgRGB: [68, 68, 68] },
      muted: { hex: '#ffffff', bg: '#555555', fgRGB: [255, 255, 255], bgRGB: [85, 85, 85] },
    },
  };
}

test('markdown preview classifies headings, list markers, quotes, inline code, and code fences', async () => {
  const preview = await loadMarkdownPreviewModule();

  const lines = preview.previewMarkdownLines([
    '# Title',
    '- item with `code`',
    '> quoted',
    '```ts',
    'const answer = 42;',
    '```',
  ].join('\n'));

  assert.deepEqual(lines, [
    {
      kind: 'heading-strong',
      segments: [{ text: 'Title', tone: 'heading-strong' }],
    },
    {
      kind: 'list',
      segments: [
        { text: '• ', tone: 'list-marker' },
        { text: 'item with ', tone: 'body' },
        { text: 'code', tone: 'inline-code' },
      ],
    },
    {
      kind: 'quote',
      segments: [
        { text: '│ ', tone: 'quote-marker' },
        { text: 'quoted', tone: 'quote-text' },
      ],
    },
    {
      kind: 'code',
      segments: [{ text: 'const answer = 42;', tone: 'code' }],
    },
  ]);
});

test('markdown preview paints headings and code blocks with distinct tokens', async () => {
  const preview = await loadMarkdownPreviewModule();
  const { createSurface } = await import('@flyingrobots/bijou');

  const surface = createSurface(24, 2, { char: ' ', empty: false });
  preview.paintMarkdownPreview(
    surface,
    '# Title\n```ts\nconst answer = 42;\n```',
    0,
    0,
    0,
    24,
    2,
    fakeTheme(),
  );

  const headingCell = surface.get(0, 0);
  assert.equal(headingCell.fg, '#ff00aa');
  assert.deepEqual(headingCell.modifiers, ['bold']);

  const codeCell = surface.get(0, 1);
  assert.equal(codeCell.fg, '#ffffff');
  assert.equal(codeCell.bg, '#333333');
});
