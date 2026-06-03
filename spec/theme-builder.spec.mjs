import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const BUILDER_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'theme-builder.js');
const STYLE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');

async function loadThemeModules() {
  await ensureDistBuilt();

  return {
    builder: await import(pathToFileURL(BUILDER_PATH).href),
    style: await import(pathToFileURL(STYLE_PATH).href),
  };
}

test('theme builder supports GSAP-like color transitions, style modifiers, gradients, and springs as data', async () => {
  const { builder, style } = await loadThemeModules();
  const start = builder.rgb(255, 0, 0);
  const end = builder.rgb(0, 255, 0);

  const theme = builder.defineJeditTheme('spec-theme', (draft) => {
    draft.chrome.activeEdge.char = '▓';
    draft.chrome.activeEdge.foregroundColor = start;
    draft.chrome.titleLogo.foregroundColor = start.to(end).easeInOut(1.5);
    draft.chrome.titleLogo.gradient = draft.gradient(start, end);
    draft.source.keyword.foregroundColor = start.to(end).easeIn(0.2);
    draft.source.keyword.modifiers = [style.JEDIT_TEXT_MODIFIER.Bold];
    draft.source.keyword.gradient = draft.gradient(start, end);
    draft.source.keyword.spring = draft.spring({ mass: 1, stiffness: 120, damping: 18 });
  });

  const activeEdge = theme.chrome.activeEdge;
  assert.equal(activeEdge.char, '▓');
  assert.equal(activeEdge.hex, start.hex);
  assert.equal(theme.chrome.titleLogo.foregroundEffect.kind, style.JEDIT_COLOR_EFFECT.Transition);
  assert.equal(theme.chrome.titleLogo.foregroundEffect.easing, style.JEDIT_EASING.EaseInOut);
  assert.equal(theme.chrome.titleLogo.gradient.stops.length, 2);

  const keyword = theme.source.get(style.JEDIT_SOURCE_TOKEN.Keyword);
  assert.equal(keyword.hex, start.toTokenValue().hex);
  assert.deepEqual(keyword.modifiers, [style.JEDIT_TEXT_MODIFIER.Bold]);
  assert.equal(keyword.foregroundEffect.kind, style.JEDIT_COLOR_EFFECT.Transition);
  assert.equal(keyword.foregroundEffect.easing, style.JEDIT_EASING.EaseIn);
  assert.equal(keyword.foregroundEffect.durationSeconds, 0.2);
  assert.equal(keyword.gradient.stops.length, 2);
  assert.deepEqual(keyword.spring, { mass: 1, stiffness: 120, damping: 18 });
});
