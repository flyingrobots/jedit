import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, symlinkSync, lstatSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { importDist, mockRuntime, fakeProductionTextSession } from './workspace-helpers.mjs';

const key = (value, flags = {}) => ({ type: 'key', key: value, ...flags });

async function modules() {
  return {
    runtime: await importDist('app', 'workspace', 'runtime.js'),
    settings: await importDist('app', 'workspace', 'settings.js'),
    drawer: await importDist('ui', 'settings-drawer.js'),
    i18n: await importDist('adapters', 'bijou-i18n-adapter.js'),
    themes: await importDist('ui', 'jedit-themes.js'),
  };
}

function text(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')
  )).join('\n');
}

function selectLeader(runtime, settings, model) {
  let opened = runtime.update(key('f2'), model)[0];
  const target = settings.settingsRows(opened).findIndex((row) => row.id === 'leader');
  assert.ok(target >= 0, 'Settings exposes a Leader row');
  for (let i = 0; i < target; i += 1) opened = runtime.update(key('down'), opened)[0];
  return opened;
}

test('Settings renders Keybindings and a default Leader with capture and cancellation', async () => {
  const m = await modules();
  const deps = mockRuntime();
  deps.initialModel.i18n = new m.i18n.BijouI18nAdapter();
  deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
  const runtime = m.runtime.createWorkspaceRuntime(deps);
  let model = runtime.init()[0];
  assert.equal(model.leaderKey?.value, '\\', 'startup defaults to the Vim Leader');
  model = selectLeader(runtime, m.settings, model);
  const render = () => text(m.drawer.renderSettingsDrawer({
    rows: m.settings.settingsRows(model), selectedIndex: model.settingsFocusIndex,
    theme: model.jeditTheme, width: 40, height: 16,
  }));
  assert.match(render(), /Keybindings/);
  assert.match(render(), /Leader.*Backslash/);
  model = runtime.update(key('enter'), model)[0];
  assert.equal(model.leaderCaptureActive, true);
  assert.match(render(), /Press a key/);
  model = runtime.update(key('escape'), model)[0];
  assert.equal(model.settingsOpen, true);
  assert.equal(model.leaderCaptureActive, false);
  assert.equal(model.leaderKey.value, '\\');
  model = runtime.update(key('enter'), model)[0];
  model = runtime.update(key('f2'), model)[0];
  assert.equal(model.settingsOpen, false);
  assert.equal(model.leaderCaptureActive, false);
});

test('Settings captures Space and custom keys, saves them, and reloads at runtime startup', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jim-leader-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const m = await modules();
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const settingsPort = createJimSettingsPort(home);
  const deps = mockRuntime({ jimSettings: settingsPort });
  deps.initialModel.i18n = new m.i18n.BijouI18nAdapter();
  deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
  const runtime = m.runtime.createWorkspaceRuntime(deps);
  let model = selectLeader(runtime, m.settings, runtime.init()[0]);
  assert.equal(existsSync(path.join(home, '.jimrc')), false);
  for (const [input, saved] of [['space', ' '], ['j', 'j'], ['q', 'q'], ['`', '`'], ['\\', '\\']]) {
    model = runtime.update(key('enter'), model)[0];
    model = runtime.update(key(input), model)[0];
    assert.equal(model.leaderKey.value, saved);
    assert.equal(model.leaderCaptureActive, false);
    assert.equal(model.settingsOpen, true);
    assert.equal(JSON.parse(readFileSync(path.join(home, '.jimrc'), 'utf8')).keybindings.leader, saved);
    assert.equal(m.runtime.createWorkspaceRuntime(deps).init()[0].leaderKey.value, saved);
  }
  assert.deepEqual(readdirSync(home), ['.jimrc']);
});

test('invalid or modified keys remain in capture, and persistence failure retains the old Leader', async () => {
  const m = await modules();
  const deps = mockRuntime();
  deps.initialModel.i18n = new m.i18n.BijouI18nAdapter();
  deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
  const runtime = m.runtime.createWorkspaceRuntime(deps);
  let model = selectLeader(runtime, m.settings, runtime.init()[0]);
  model = runtime.update(key('enter'), model)[0];
  for (const event of [key('up'), key('enter'), key('a', { ctrl: true }), key('a', { alt: true }), key('a', { shift: true }), key('\n'), key('ab')]) {
    model = runtime.update(event, model)[0];
    assert.equal(model.leaderCaptureActive, true);
    assert.equal(model.leaderKey.value, '\\');
    assert.equal(model.leaderCaptureInvalid, true);
  }
  model = runtime.update(key(','), model)[0];
  assert.equal(model.leaderCaptureActive, false);
  assert.equal(model.leaderKey.value, '\\');
  assert.ok(model.leaderSettingsIssue, 'an absent persistence adapter cannot claim a saved key');
});

test('.jimrc preserves unrelated fields and never replaces malformed or unreadable configuration', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jimrc-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const { LeaderKey } = await importDist('domain', 'leader-key.js');
  const port = createJimSettingsPort(home);
  const rc = path.join(home, '.jimrc');
  writeFileSync(rc, '{"theme":"custom","keybindings":{"other":[1,true],"leader":" "}}\n');
  assert.equal(port.load().leaderKey.value, ' ');
  assert.equal(port.saveLeader(LeaderKey.from(',')), undefined);
  assert.deepEqual(JSON.parse(readFileSync(rc, 'utf8')), {
    theme: 'custom', keybindings: { other: [1, true], leader: ',' },
  });
  for (const source of ['not json', '[]', '{"keybindings":{"leader":"enter"}}', '{"keybindings":false}']) {
    writeFileSync(rc, source);
    assert.equal(port.load().leaderKey.value, '\\');
    assert.ok(port.load().issue);
    assert.ok(port.saveLeader(LeaderKey.from(' ')));
    assert.equal(readFileSync(rc, 'utf8'), source);
  }
  rmSync(rc);
  mkdirSync(rc);
  assert.ok(port.load().issue);
  assert.ok(port.saveLeader(LeaderKey.from(' ')));
});

test('startup configuration errors stay visible and a repaired file can be saved', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jimrc-retry-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const m = await modules();
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const rc = path.join(home, '.jimrc');
  writeFileSync(rc, '{bad');
  const deps = mockRuntime({ jimSettings: createJimSettingsPort(home) });
  deps.initialModel.i18n = new m.i18n.BijouI18nAdapter();
  deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
  const runtime = m.runtime.createWorkspaceRuntime(deps);
  let model = selectLeader(runtime, m.settings, runtime.init()[0]);
  assert.ok(model.leaderSettingsIssue);
  model = runtime.update(key('enter'), model)[0];
  model = runtime.update(key('up'), model)[0];
  model = runtime.update(key('escape'), model)[0];
  assert.match(m.settings.settingsRows(model).find((row) => row.id === 'leader').description, /\.jimrc is invalid/);
  model = runtime.update(key('enter'), model)[0];
  model = runtime.update(key('space'), model)[0];
  assert.equal(model.leaderKey.value, '\\');
  assert.equal(readFileSync(rc, 'utf8'), '{bad');
  writeFileSync(rc, '{}');
  model = runtime.update(key('enter'), model)[0];
  model = runtime.update(key('space'), model)[0];
  assert.equal(model.leaderKey.value, ' ');
  assert.equal(model.leaderSettingsIssue, undefined);
});

test('Leader validation accepts printable single keys and rejects controls and named keys', async () => {
  const { LeaderKey } = await importDist('domain', 'leader-key.js');
  for (const value of [' ', '\\', ',', 'é', '🦀']) assert.equal(LeaderKey.from(value)?.value, value);
  for (const value of ['', 'enter', '\n', '\t', '\u001b', '\u007f', '\u200b', '\ud800', 'ab']) {
    assert.equal(LeaderKey.from(value), undefined);
  }
  assert.throws(() => Reflect.construct(LeaderKey, [Symbol('forged'), 'enter']));
  assert.throws(() => { LeaderKey.Default.value = 'enter'; });
  assert.equal(LeaderKey.Default.value, '\\');
});

test('.jimrc saves refuse documents whose numbers would change and keep the file mode', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jimrc-lossless-'));
  const previousUmask = process.umask(0o077);
  t.after(() => { process.umask(previousUmask); rmSync(home, { recursive: true, force: true }); });
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const { LeaderKey } = await importDist('domain', 'leader-key.js');
  const port = createJimSettingsPort(home);
  const rc = path.join(home, '.jimrc');
  for (const source of ['{"id":9007199254740993}', '{"limit":1e400}', '{"ratio":0.10000000000000000001}']) {
    writeFileSync(rc, source);
    assert.ok(port.saveLeader(LeaderKey.from(',')), source);
    assert.equal(readFileSync(rc, 'utf8'), source);
  }
  writeFileSync(rc, '{"n":1.0,"m":-0,"e":2.5e3,"s":"9007199254740993"}');
  chmodSync(rc, 0o664);
  assert.equal(port.saveLeader(LeaderKey.from(',')), undefined);
  assert.deepEqual(JSON.parse(readFileSync(rc, 'utf8')), { n: 1, m: 0, e: 2500, s: '9007199254740993', keybindings: { leader: ',' } });
  assert.equal(statSync(rc).mode & 0o777, 0o664);
});

test('mouse scrolling cannot move Settings focus away from an active Leader capture', async () => {
  const m = await modules();
  const deps = mockRuntime();
  deps.initialModel.i18n = new m.i18n.BijouI18nAdapter();
  deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
  const runtime = m.runtime.createWorkspaceRuntime(deps);
  const capturing = runtime.update(key('enter'), selectLeader(runtime, m.settings, runtime.init()[0]))[0];
  const scroll = { type: 'mouse', button: 'none', action: 'scroll-down', col: 4, row: 6, shift: false, alt: false, ctrl: false };
  const scrolled = runtime.update(scroll, capturing)[0];
  assert.equal(scrolled.settingsFocusIndex, capturing.settingsFocusIndex);
  assert.equal(scrolled.leaderCaptureActive, true);
  assert.equal(runtime.update(key('c', { ctrl: true }), capturing)[1].length, 1, 'Ctrl+C still quits during capture');
});

test('saving a dotfile symlink updates its target and preserves the symlink', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jimrc-link-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const { LeaderKey } = await importDist('domain', 'leader-key.js');
  const target = path.join(home, 'settings.json');
  writeFileSync(target, '{"keybindings":{"leader":","},"theme":"custom"}');
  symlinkSync(target, path.join(home, '.jimrc'));
  const port = createJimSettingsPort(home);
  assert.equal(port.saveLeader(LeaderKey.from(' ')), undefined);
  assert.equal(lstatSync(path.join(home, '.jimrc')).isSymbolicLink(), true);
  assert.equal(JSON.parse(readFileSync(target, 'utf8')).keybindings.leader, ' ');
});

test('an atomic-write failure leaves the active Leader and shows a retryable row error', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jimrc-write-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const m = await modules();
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const port = createJimSettingsPort(path.join(home, 'missing'));
  const deps = mockRuntime({ jimSettings: port });
  deps.initialModel.i18n = new m.i18n.BijouI18nAdapter();
  deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
  const runtime = m.runtime.createWorkspaceRuntime(deps);
  let model = selectLeader(runtime, m.settings, runtime.init()[0]);
  model = runtime.update(key('enter'), model)[0];
  model = runtime.update(key('space'), model)[0];
  assert.equal(model.leaderKey.value, '\\');
  assert.match(m.settings.settingsRows(model).find((row) => row.id === 'leader').description, /Could not save/);
  mkdirSync(path.join(home, 'missing'));
  model = runtime.update(key('enter'), model)[0];
  model = runtime.update(key('space'), model)[0];
  assert.equal(model.leaderKey.value, ' ');
  assert.equal(model.leaderSettingsIssue, undefined);
});

test('production app composition saves and restores Leader through its settings port', async (t) => {
  const home = mkdtempSync(path.join(tmpdir(), 'jimrc-app-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const m = await modules();
  const { createWorkspaceApp } = await importDist('adapters', 'workspace-app.js');
  const { createJimSettingsPort } = await importDist('adapters', 'jim-settings.js');
  const seed = mockRuntime().initialModel;
  seed.i18n = new m.i18n.BijouI18nAdapter();
  seed.jeditTheme = m.themes.availableJeditThemes()[0];
  const options = {
    initialColumns: 80, initialRows: 24, initialWorkingDirectory: home,
    perfEnabled: false, seed, jimSettings: createJimSettingsPort(home),
  };
  const textHost = { productionTextSession: fakeProductionTextSession(), closeProductionText: async () => {} };
  const app = createWorkspaceApp(options, textHost);
  let model = selectLeader(app, m.settings, app.init()[0]);
  model = app.update(key('enter'), model)[0];
  assert.match(text(app.view(model)), /Press a key/);
  assert.doesNotMatch(text(app.view(model)), /q close/);
  assert.match(text(app.view(model)), /Esc cancels/);
  model = app.update(key('space'), model)[0];
  assert.equal(model.leaderKey.value, ' ');
  assert.match(text(app.view(model)), /Leader.*Space/);
  assert.equal(createWorkspaceApp(options, textHost).init()[0].leaderKey.value, ' ');
});

test('the Leader row and capture prompt render in LTR and RTL locales', async () => {
  const m = await modules();
  for (const [locale, section, capture] of [
    ['en', 'Keybindings', 'Press a key'],
    ['ar', 'اختصارات لوحة المفاتيح', 'اضغط مفتاحًا'],
    ['he', 'קיצורי מקשים', 'לחצו על מקש'],
  ]) {
    const deps = mockRuntime();
    deps.initialModel.i18n = new m.i18n.BijouI18nAdapter().withLocale(locale);
    deps.initialModel.jeditTheme = m.themes.availableJeditThemes()[0];
    const runtime = m.runtime.createWorkspaceRuntime(deps);
    let model = selectLeader(runtime, m.settings, runtime.init()[0]);
    model = runtime.update(key('enter'), model)[0];
    const rendered = text(m.drawer.renderSettingsDrawer({
      rows: m.settings.settingsRows(model), selectedIndex: model.settingsFocusIndex,
      theme: model.jeditTheme, width: 60, height: 16,
    }));
    assert.ok(rendered.includes(section), locale);
    assert.ok(rendered.includes(capture), locale);
    assert.equal(model.leaderKey.value, '\\');
  }
});
