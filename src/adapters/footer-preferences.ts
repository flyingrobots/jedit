import { FILEPATH_STYLE } from '../ports/filepath-style.js';
import { closeSync, existsSync, fchmodSync, fsyncSync, openSync, lstatSync, readFileSync,
  realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FOOTER_LAYOUT } from '../ports/footer-preferences.js';
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
    loadFilepaths: () => {
      try { return footerPreferenceDocument(readDocument(path)).filepathStyle; }
      catch { return FILEPATH_STYLE.GitRoot; }
    },
    save: (layout) => savePreference(path, (document) => document.withLayout(layout)),
    saveFilepaths: (style) => savePreference(path, (document) => document.withFilepaths(style)),
  };
}

function readDocument(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : DEFAULT_DOCUMENT;
}

type PreferenceEdit = (document: ReturnType<typeof footerPreferenceDocument>) => string;

function saveDocument(path: string, edit: PreferenceEdit): void {
  const target = preferenceTarget(path);
  withPreferenceLock(target, () => replaceDocument(target, edit));
}

function replaceDocument(target: string, edit: PreferenceEdit): void {
  const source = readDocument(target);
  const next = edit(footerPreferenceDocument(source));
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

function savePreference(path: string, edit: PreferenceEdit) {
  try { saveDocument(path, edit); return { ok: true } as const; }
  catch { return { ok: false } as const; }
}

function preferenceTarget(path: string): string {
  const entry = lstatSync(path, { throwIfNoEntry: false });
  return entry == null ? path : realpathSync(path);
}

function withPreferenceLock(path: string, write: () => void): void {
  const lock = `${path}.lock`;
  const fd = openSync(lock, 'wx', PRIVATE_MODE);
  try { write(); }
  finally {
    try { closeSync(fd); }
    finally { unlinkSync(lock); }
  }
}
