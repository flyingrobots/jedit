import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const KEYBINDINGS_PATH = path.join(REPO_ROOT, 'dist', 'app', 'keybindings.js');

async function loadKeybindingsModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(KEYBINDINGS_PATH).href);
}

test('jedit keybindings reject duplicate physical keys across actions', async () => {
  const keybindings = await loadKeybindingsModule();
  const duplicate = {
    action: keybindings.JEDIT_KEY_ACTION.ToggleMarkdownPreview,
    key: keybindings.JEDIT_SETTINGS_TOGGLE_KEY,
    label: keybindings.JEDIT_SETTINGS_TOGGLE_LABEL,
  };

  assert.doesNotThrow(() => keybindings.ensureUniqueJeditKeyBindings(keybindings.JEDIT_KEY_BINDINGS));
  assert.throws(
    () => keybindings.ensureUniqueJeditKeyBindings([...keybindings.JEDIT_KEY_BINDINGS, duplicate]),
    /Duplicate jedit key binding/,
  );
});

test('settings and markdown preview use different function keys', async () => {
  const keybindings = await loadKeybindingsModule();

  assert.equal(keybindings.JEDIT_SETTINGS_TOGGLE_KEY, 'f2');
  assert.equal(keybindings.JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY, 'f3');
  assert.notEqual(keybindings.JEDIT_SETTINGS_TOGGLE_KEY, keybindings.JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY);
});
