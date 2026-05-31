import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'feedback.js');
const NOTICE_TITLE = 'Runtime error';
const NOTICE_MESSAGE = 'profile failed';
const EXPECTED_NOTIFICATION_COUNT = 1;
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

test('feedback state uses typed notifications and keeps footer visibility separate', async () => {
  const feedback = await loadFeedbackModule();
  const state = feedback.createFeedbackState();

  assert.equal(state.notificationLoopActive, false);
  assert.equal(state.footerVisible, true);
  assert.ok(state.notifications);
});

test('feedback errors enter the typed notification stack', async () => {
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

  assert.equal(nextModel.notificationLoopActive, true);
  assert.equal(nextModel.notifications.items.length, EXPECTED_NOTIFICATION_COUNT);
  assert.equal(nextModel.notifications.items[0].title, NOTICE_TITLE);
  assert.equal(nextModel.notifications.items[0].message, NOTICE_MESSAGE);
});
