import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'markdown-preview.js');
const THEME_BUILDER_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'theme-builder.js');
const JEDIT_THEME_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');

async function loadMarkdownPreviewModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    preview: await import(pathToFileURL(MODULE_PATH).href),
    themeBuilder: await import(pathToFileURL(THEME_BUILDER_PATH).href),
    jeditTheme: await import(pathToFileURL(JEDIT_THEME_PATH).href),
  };
}

test('markdown preview classifies headings, list markers, quotes, inline code, and code fences', async () => {
  const { preview } = await loadMarkdownPreviewModules();

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
  const { preview, themeBuilder, jeditTheme } = await loadMarkdownPreviewModules();
  const { createSurface } = await import('@flyingrobots/bijou');
  const headingColor = themeBuilder.rgb(191, 40, 140);
  const codeForeground = themeBuilder.rgb(220, 230, 240);
  const codeBackground = themeBuilder.rgb(24, 31, 42);
  const theme = themeBuilder.defineJeditTheme('markdown-preview-spec', (draft) => {
    draft.markdown.headingStrong.foregroundColor = headingColor;
    draft.markdown.headingStrong.modifiers = [jeditTheme.JEDIT_TEXT_MODIFIER.Underline];
    draft.markdown.code.foregroundColor = codeForeground;
    draft.markdown.code.backgroundColor = codeBackground;
  });

  const surface = createSurface(24, 2, { char: ' ', empty: false });
  preview.paintMarkdownPreview(
    surface,
    '# Title\n```ts\nconst answer = 42;\n```',
    0,
    0,
    0,
    24,
    2,
    theme,
  );

  const headingCell = surface.get(0, 0);
  assert.equal(headingCell.fg, headingColor.hex);
  assert.deepEqual(headingCell.modifiers, [jeditTheme.JEDIT_TEXT_MODIFIER.Underline]);

  const codeCell = surface.get(0, 1);
  assert.equal(codeCell.fg, codeForeground.hex);
  assert.equal(codeCell.bg, codeBackground.hex);
});
