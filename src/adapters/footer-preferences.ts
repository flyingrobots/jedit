import { closeSync, existsSync, fchmodSync, fsyncSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FOOTER_LAYOUT, type FooterLayout } from '../ui/footer-layout.js';
import type { FooterPreferencesPort } from '../ports/footer-preferences.js';
import { footerPreferenceDocument } from './footer-preference-json.js';

const PRIVATE_MODE = 0o600;
const PERMISSION_MASK = 0o777;
const DEFAULT_DOCUMENT = '{}\n';

export function createFooterPreferences(path = join(homedir(), '.jimrc')): FooterPreferencesPort {
  return {
    load: () => {
      try { return footerPreferenceDocument(readDocument(path)).layout; }
      catch { return FOOTER_LAYOUT.Focused; }
    },
    save: (layout) => {
      try { saveDocument(path, layout); return { ok: true }; }
      catch { return { ok: false }; }
    },
  };
}

function readDocument(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : DEFAULT_DOCUMENT;
}

function saveDocument(path: string, layout: FooterLayout): void {
  const target = existsSync(path) ? realpathSync(path) : path;
  const source = readDocument(target);
  const next = footerPreferenceDocument(source).withLayout(layout);
  const mode = existsSync(target) ? statSync(target).mode & PERMISSION_MASK : PRIVATE_MODE;
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    writeTemporary(temporary, next, mode);
    if (readDocument(target) !== source) throw new PreferencesChangedError();
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function writeTemporary(path: string, source: string, mode: number): void {
  const fd = openSync(path, 'wx', mode);
  try {
    fchmodSync(fd, mode);
    writeFileSync(fd, source, 'utf8');
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

class PreferencesChangedError extends Error {
  constructor() { super('Preferences changed while saving'); }
}
