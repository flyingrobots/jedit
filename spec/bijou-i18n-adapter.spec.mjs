import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const ADAPTER_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'bijou-i18n-adapter.js');
const GENERATED_I18N_PATH = path.join(REPO_ROOT, 'dist', 'generated', 'i18n.js');
const EXTRA_LOCALE = 'zz';

async function loadI18nModules() {
  await ensureDistBuilt();

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
    direction: 'rtl',
  };

  try {
    const i18n = new adapter.BijouI18nAdapter();
    i18n.setLocale(EXTRA_LOCALE);

    assert.equal(i18n.locale, EXTRA_LOCALE);
    assert.equal(i18n.localeLabel, 'Extra');
    assert.equal(i18n.direction, 'rtl');
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

  assert.deepEqual(generated.locales, [
    'en',
    'fr',
    'it',
    'de',
    'es',
    'ko',
    'ja',
    'zh-Hans',
    'pt-BR',
    'ru',
    'ar',
    'id',
    'tr',
    'hi',
    'nl',
    'pl',
    'vi',
    'th',
    'fa',
    'he',
    'me',
  ]);
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
      ['ru', 'Русский', 'ltr'],
      ['ar', 'العربية', 'rtl'],
      ['id', 'Bahasa Indonesia', 'ltr'],
      ['tr', 'Türkçe', 'ltr'],
      ['hi', 'हिन्दी', 'ltr'],
      ['nl', 'Nederlands', 'ltr'],
      ['pl', 'Polski', 'ltr'],
      ['vi', 'Tiếng Việt', 'ltr'],
      ['th', 'ไทย', 'ltr'],
      ['fa', 'فارسی', 'rtl'],
      ['he', 'עברית', 'rtl'],
      ['me', 'Mirror English', 'rtl'],
    ],
  );

  i18n.setLocale('ja');

  assert.equal(i18n.localeLabel, '日本語');
  assert.equal(i18n.direction, 'ltr');
  assert.equal(i18n.t('footer.mode.preview'), generated.ja.footer.mode.preview);

  i18n.setLocale('me');

  assert.equal(i18n.localeLabel, 'Mirror English');
  assert.equal(i18n.direction, 'rtl');

  i18n.setLocale('missing-locale');

  assert.equal(i18n.locale, 'en');
  assert.equal(i18n.direction, 'ltr');
});

test('mirror English preserves interpolation placeholders while reversing surrounding text', async () => {
  const { adapter, generated } = await loadI18nModules();
  const i18n = new adapter.BijouI18nAdapter('me');

  assert.equal(generated.me.footer.context.history_count, '{count} :ecnedive ohcE');
  assert.equal(i18n.t('footer.context.history_count', { count: 3 }), '3 :ecnedive ohcE');
});
