import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPO_ROOT = process.cwd();

const PREBUILT_DIST_ENV = 'JEDIT_DIST_PREBUILT';
const PREBUILT_DIST_ENABLED = '1';
const DIST_MAIN_PATH = path.join(REPO_ROOT, 'dist', 'main.js');

let distBuildPromise;

export function isPrebuiltDistEnabled() {
  return process.env[PREBUILT_DIST_ENV] === PREBUILT_DIST_ENABLED;
}

export async function ensureDistBuilt() {
  if (isPrebuiltDistEnabled()) {
    assert.ok(existsSync(DIST_MAIN_PATH), `${DIST_MAIN_PATH} should exist when ${PREBUILT_DIST_ENV}=1`);
    return;
  }
  if (distBuildPromise == null) {
    distBuildPromise = Promise.resolve().then(() => {
      const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      assert.equal(build.status, 0, build.stderr || build.stdout);
    });
  }
  await distBuildPromise;
}

export function ensureDistBuiltSync() {
  if (isPrebuiltDistEnabled()) {
    assert.ok(existsSync(DIST_MAIN_PATH), `${DIST_MAIN_PATH} should exist when ${PREBUILT_DIST_ENV}=1`);
    return;
  }
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  distBuildPromise = Promise.resolve();
}

export async function importDist(...parts) {
  await ensureDistBuilt();
  return import(pathToFileURL(path.join(REPO_ROOT, 'dist', ...parts)).href);
}
