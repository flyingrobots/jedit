import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createSurface } from '@flyingrobots/bijou';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'feedback.js');
const NOTICE_TITLE = 'Runtime error';
const NOTICE_MESSAGE = 'profile failed';
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

test('feedback state uses typed notifications and keeps footer visibility separate', async () => {
  const feedback = await loadFeedbackModule();
  const state = feedback.createFeedbackState();

  assert.equal(state.notificationLoopActive, false);
  assert.equal(state.footerVisible, true);
  assert.ok(state.notifications);
});

test('feedback errors render through the notification stack', async () => {
  const feedback = await loadFeedbackModule();
  const model = {
    columns: 80,
    rows: 24,
    ...feedback.createFeedbackState(),
  };
  const [nextModel] = feedback.pushErrorToast(
    model,
    NOTICE_TITLE,
    NOTICE_MESSAGE,
    1000,
    () => async () => ({ type: 'notification-tick', atMs: 1040 }),
  );

  const rendered = feedback.compositeFeedback(createSurface(56, 12), nextModel.notifications, 56, 12);
  const text = surfaceText(rendered);

  assert.match(text, new RegExp(NOTICE_TITLE));
  assert.match(text, new RegExp(NOTICE_MESSAGE));
});
