import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createSurface } from '@flyingrobots/bijou';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'feedback.js');
const PERF_NOTICE = 'Perf stream started';
let feedbackModulePromise;

async function loadFeedbackModule() {
  if (feedbackModulePromise != null) {
    return feedbackModulePromise;
  }

  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  feedbackModulePromise = import(pathToFileURL(MODULE_PATH).href);
  return feedbackModulePromise;
}

function surfaceText(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')
  )).join('\n');
}

test('feedback state uses a single notice like the Think browse shell', async () => {
  const feedback = await loadFeedbackModule();

  assert.deepEqual(
    feedback.createFeedbackState(),
    {
      notice: null,
      footerVisible: true,
    },
  );
});

test('notice clears on the next key action', async () => {
  const feedback = await loadFeedbackModule();
  const model = {
    columns: 80,
    rows: 24,
    notice: 'Reflect saved',
    marker: 'same model shape',
  };

  assert.deepEqual(
    feedback.clearNoticeOnKey(model),
    {
      columns: 80,
      rows: 24,
      notice: null,
      marker: 'same model shape',
    },
  );
});

test('feedback notices render through the anchored toast overlay', async () => {
  const feedback = await loadFeedbackModule();
  const base = createSurface(48, 10);
  const rendered = feedback.compositeFeedback(base, PERF_NOTICE, 48, 10);
  const text = surfaceText(rendered);
  const noticeRow = text.split('\n').findIndex((line) => line.includes(PERF_NOTICE));

  assert.match(text, new RegExp(PERF_NOTICE));
  assert.ok(noticeRow >= 5, `Expected the toast near the bottom of the viewport, got row ${noticeRow}.`);
});
