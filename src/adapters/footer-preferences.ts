import { FILEPATH_STYLE } from '../ports/filepath-style.js';
import { closeSync, existsSync, fchmodSync, fsyncSync, openSync, lstatSync, readFileSync,
  realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { JIMRC_CREATE_MODE, JIMRC_FILENAME, JIMRC_PERMISSION_BITS } from './jimrc-file.js';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FOOTER_LAYOUT } from '../ports/footer-preferences.js';
import type { FooterPreferencesPort } from '../ports/footer-preferences.js';
import { EMPTY_PREFERENCE_DOCUMENT, footerPreferenceDocument } from './footer-preference-json.js';


export function createFooterPreferences(path = join(homedir(), JIMRC_FILENAME)): FooterPreferencesPort {
  return {
    loadLayout: () => {
      try { return footerPreferenceDocument(readDocument(path)).layout; }
      catch { return FOOTER_LAYOUT.Focused; }
    },
    loadFilepaths: () => {
      try { return footerPreferenceDocument(readDocument(path)).filepathStyle; }
      catch { return FILEPATH_STYLE.GitRoot; }
    },
    saveLayout: (layout) => savePreference(path, (document) => document.withLayout(layout)),
    saveFilepaths: (style) => savePreference(path, (document) => document.withFilepaths(style)),
  };
}

function readDocument(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : EMPTY_PREFERENCE_DOCUMENT;
}

type PreferenceEdit = (document: ReturnType<typeof footerPreferenceDocument>) => string;

// No lock file: a lock the leader-key writer ignores would exclude nobody, and a
// stale one would refuse every later save. The document is re-read just before
// the rename instead, and a concurrent change refuses the save.
function saveDocument(path: string, edit: PreferenceEdit): void {
  replaceDocument(preferenceTarget(path), edit);
}

function replaceDocument(target: string, edit: PreferenceEdit): void {
  const source = readDocument(target);
  const next = edit(footerPreferenceDocument(source));
  const mode = existsSync(target) ? statSync(target).mode & JIMRC_PERMISSION_BITS : JIMRC_CREATE_MODE;
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
  const fd = openSync(path, 'wx', JIMRC_CREATE_MODE);
  try {
    writeFileSync(fd, source, 'utf8');
    // Applied after writing: a write by a non-root owner clears setuid/setgid.
    fchmodSync(fd, mode);
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
