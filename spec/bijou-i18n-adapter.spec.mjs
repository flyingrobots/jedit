import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const ADAPTER_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'bijou-i18n-adapter.js');
const GENERATED_I18N_PATH = path.join(REPO_ROOT, 'dist', 'generated', 'i18n.js');
const EXTRA_LOCALE = 'zz';

async function loadI18nModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [adapter, generated] = await Promise.all([
    import(pathToFileURL(ADAPTER_PATH).href),
    import(pathToFileURL(GENERATED_I18N_PATH).href),
  ]);
  return { adapter, generated };
}

test('locale resolution follows the runtime catalog registry', async () => {
  const { adapter, generated } = await loadI18nModules();
  const original = generated.catalogs[EXTRA_LOCALE];
  const originalMetadata = generated.localeMetadata[EXTRA_LOCALE];
  generated.catalogs[EXTRA_LOCALE] = generated.en;
  generated.localeMetadata[EXTRA_LOCALE] = {
    label: 'Extra',
    direction: 'ltr',
  };

  try {
    const i18n = new adapter.BijouI18nAdapter();
    i18n.setLocale(EXTRA_LOCALE, 'ltr');

    assert.equal(i18n.locale, EXTRA_LOCALE);
    assert.equal(i18n.localeLabel, 'Extra');
    assert.equal(i18n.t('footer.mode.browse'), generated.en.footer.mode.browse);
  } finally {
    if (original === undefined) {
      delete generated.catalogs[EXTRA_LOCALE];
    } else {
      generated.catalogs[EXTRA_LOCALE] = original;
    }
    if (originalMetadata === undefined) {
      delete generated.localeMetadata[EXTRA_LOCALE];
    } else {
      generated.localeMetadata[EXTRA_LOCALE] = originalMetadata;
    }
  }
});

test('generated catalogs include the installed application locales', async () => {
  const { adapter, generated } = await loadI18nModules();
  const i18n = new adapter.BijouI18nAdapter();

  assert.deepEqual(generated.locales, ['en', 'fr', 'it', 'de', 'es', 'ko', 'ja', 'zh-Hans', 'pt-BR', 'me']);
  assert.deepEqual(
    i18n.locales.map((locale) => [locale.locale, locale.label, locale.direction]),
    [
      ['en', 'English', 'ltr'],
      ['fr', 'Français', 'ltr'],
      ['it', 'Italiano', 'ltr'],
      ['de', 'Deutsch', 'ltr'],
      ['es', 'Español', 'ltr'],
      ['ko', '한국어', 'ltr'],
      ['ja', '日本語', 'ltr'],
      ['zh-Hans', '简体中文', 'ltr'],
      ['pt-BR', 'Português (Brasil)', 'ltr'],
      ['me', 'Mirror English', 'rtl'],
    ],
  );

  i18n.setLocale('ja', 'ltr');

  assert.equal(i18n.localeLabel, '日本語');
  assert.equal(i18n.t('footer.mode.preview'), generated.ja.footer.mode.preview);
});
