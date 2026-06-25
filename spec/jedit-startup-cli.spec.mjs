import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { REPO_ROOT, ensureDistBuiltSync, importDist } from './dist-helpers.mjs';

const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const DIST_MAIN_PATH = path.join(REPO_ROOT, 'dist', 'main.js');
const MAIN_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'main.ts');
const STARTUP_CLI_APP_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'app', 'jedit-startup-cli.ts');
const STARTUP_CLI_ADAPTER_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'adapters', 'jedit-startup-cli.ts');
const PACKAGE_IDENTITY_ADAPTER_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'adapters', 'jedit-package-identity.ts');
const EMPTY_ARGS = [];
const FILE_ARG = ['README.md'];
const VERSION_ARGS = [
  ['--version'],
  ['-V'],
];
const HELP_ARGS = [
  ['--help'],
  ['-h'],
];
const HELP_USAGE_LINE = 'Usage: jedit [--version|-V] [--help|-h]';
const EXIT_OK = 0;
const STARTUP_FLAG_TIMEOUT_MS = 3000;

function packageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function runJeditStartupFlag(flag) {
  ensureDistBuiltSync();
  return spawnSync(process.execPath, [DIST_MAIN_PATH, flag], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: STARTUP_FLAG_TIMEOUT_MS,
  });
}

function sourceText(filePath) {
  return readFileSync(filePath, 'utf8');
}

test('jedit package identity matches package.json version', async () => {
  const identity = await importDist('adapters', 'jedit-package-identity.js');
  const manifest = packageJson();

  assert.equal(manifest.name, identity.JEDIT_PACKAGE_NAME);
  assert.equal(manifest.version, identity.JEDIT_PACKAGE_VERSION);
  assert.equal(identity.jeditPackageVersionLine(), `${manifest.name} ${manifest.version}`);
});

test('jedit startup identity derives from package.json at runtime boundary', async () => {
  const source = sourceText(PACKAGE_IDENTITY_ADAPTER_SOURCE_PATH);
  const manifest = packageJson();

  assert.equal(source.includes(`'${manifest.version}'`), false);
  assert.match(source, /package\.json/);
});

test('jedit startup bootstrap defers workspace imports until after identity flags', () => {
  const source = sourceText(MAIN_SOURCE_PATH);

  assert.equal(source.includes("from '@flyingrobots/bijou-tui'"), false);
  assert.equal(source.includes("from './adapters/workspace-app.js'"), false);
  assert.match(source, /import\('\.\/main-workspace\.js'\)/);
});

test('jedit app startup action does not decode raw argv strings', () => {
  const appSource = sourceText(STARTUP_CLI_APP_SOURCE_PATH);
  const adapterSource = sourceText(STARTUP_CLI_ADAPTER_SOURCE_PATH);

  assert.equal(appSource.includes('--version'), false);
  assert.equal(appSource.includes('--help'), false);
  assert.equal(appSource.includes('-V'), false);
  assert.equal(appSource.includes('-h'), false);
  assert.match(adapterSource, /--version/);
  assert.match(adapterSource, /--help/);
});

test('jedit startup CLI prints version for long and short flags', async () => {
  const startup = await importDist('adapters', 'jedit-startup-cli.js');
  const identity = await importDist('adapters', 'jedit-package-identity.js');
  const versionText = `${identity.jeditPackageVersionLine()}\n`;

  for (const args of VERSION_ARGS) {
    assert.deepEqual(startup.jeditStartupCliAction(args), {
      kind: startup.JEDIT_STARTUP_CLI_PRINT,
      text: versionText,
    });
  }
});

test('jedit startup CLI prints help for long and short flags', async () => {
  const startup = await importDist('adapters', 'jedit-startup-cli.js');
  const identity = await importDist('adapters', 'jedit-package-identity.js');

  for (const args of HELP_ARGS) {
    const action = startup.jeditStartupCliAction(args);

    assert.equal(action.kind, startup.JEDIT_STARTUP_CLI_PRINT);
    assert.match(action.text, new RegExp(`^${identity.jeditPackageVersionLine()}`));
    assert.ok(action.text.includes(HELP_USAGE_LINE));
    assert.match(action.text, /--version/);
    assert.match(action.text, /--help/);
  }
});

test('jedit startup CLI ignores non-identity startup arguments', async () => {
  const startup = await importDist('adapters', 'jedit-startup-cli.js');

  assert.equal(startup.jeditStartupCliAction(EMPTY_ARGS), null);
  assert.equal(startup.jeditStartupCliAction(FILE_ARG), null);
});

test('jedit executable prints startup identity before TUI initialization', async () => {
  const identity = await importDist('adapters', 'jedit-package-identity.js');

  const version = runJeditStartupFlag('--version');
  assert.equal(version.status, EXIT_OK);
  assert.equal(version.stderr, '');
  assert.equal(version.stdout, `${identity.jeditPackageVersionLine()}\n`);

  const help = runJeditStartupFlag('--help');
  assert.equal(help.status, EXIT_OK);
  assert.equal(help.stderr, '');
  assert.match(help.stdout, new RegExp(`^${identity.jeditPackageVersionLine()}`));
  assert.ok(help.stdout.includes(HELP_USAGE_LINE));
});
