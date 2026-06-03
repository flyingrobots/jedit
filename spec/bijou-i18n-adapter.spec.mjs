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
  generated.catalogs[EXTRA_LOCALE] = generated.en;

  try {
    const i18n = new adapter.BijouI18nAdapter();
    i18n.setLocale(EXTRA_LOCALE, 'ltr');

    assert.equal(i18n.locale, EXTRA_LOCALE);
    assert.equal(i18n.t('footer.mode.browse'), generated.en.footer.mode.browse);
  } finally {
    if (original === undefined) {
      delete generated.catalogs[EXTRA_LOCALE];
    } else {
      generated.catalogs[EXTRA_LOCALE] = original;
    }
  }
});
