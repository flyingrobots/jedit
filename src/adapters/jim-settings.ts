import { closeSync, fchmodSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LeaderKey } from '../domain/leader-key.js';
import {
  JimSettingsIssueKinds,
  type JimSettingsIssue,
  type JimSettingsPort,
} from '../ports/jim-settings.js';

export const JIMRC_FILENAME = '.jimrc';
const CONFIG_ENCODING = 'utf8';
const CONFIG_INDENT = 2;
const CONFIG_CREATE_MODE = 0o600;
const MISSING_FILE_CODE = 'ENOENT';
const PERMISSION_BITS = 0o7777;
// Strings are matched first so digits inside them are skipped; the remaining
// matches are exactly the document's number literals.
const JSON_STRING_OR_NUMBER = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
const DECIMAL_PARTS = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
const JSON_STRING_QUOTE = '"';
const DECIMAL_ZERO = '0';
const LEADING_ZEROS = /^0+/;
const TRAILING_ZERO = '0';
type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
interface JsonObject { [key: string]: JsonValue }
interface ConfigFile { readonly document: JsonObject; readonly mode: number; readonly path: string; readonly lossless: boolean }

// JSON is decoded only at this filesystem boundary. Arbitrary unrelated fields
// remain JSON data; they never become application configuration or executable code.
export function createJimSettingsPort(homeDirectory = homedir()): JimSettingsPort {
  const path = join(homeDirectory, JIMRC_FILENAME);
  return {
    load: () => {
      const file = readConfig(path);
      return isIssue(file)
        ? { leaderKey: LeaderKey.Default, issue: file }
        : { leaderKey: leaderFromDocument(file.document) ?? LeaderKey.Default };
    },
    saveLeader: (leader) => {
      const file = readConfig(path);
      if (isIssue(file)) return file;
      // Rewriting a document whose numbers JavaScript cannot represent exactly
      // would silently change unrelated settings, so refuse instead.
      if (!file.lossless || !(leader instanceof LeaderKey)) return { kind: JimSettingsIssueKinds.Invalid };
      const bindings = file.document['keybindings'];
      const document = {
        ...file.document,
        keybindings: { ...(isObject(bindings) ? bindings : {}), leader: leader.value },
      };
      return replaceConfig(file.path, `${JSON.stringify(document, null, CONFIG_INDENT)}\n`, file.mode);
    },
  };
}

function readConfig(path: string): ConfigFile | JimSettingsIssue {
  let source: string;
  let mode: number;
  let resolvedPath: string;
  try {
    source = readFileSync(path, CONFIG_ENCODING);
    mode = statSync(path).mode;
    resolvedPath = realpathSync(path);
  } catch (cause) {
    return cause instanceof Error && 'code' in cause && cause.code === MISSING_FILE_CODE
      ? missingConfig(path)
      : { kind: JimSettingsIssueKinds.Read, detail: cause instanceof Error ? cause.message : undefined };
  }
  try {
    const value: JsonValue = JSON.parse(source);
    if (!isObject(value) || !validBindings(value['keybindings'])) {
      return { kind: JimSettingsIssueKinds.Invalid };
    }
    return { document: value, mode, path: resolvedPath, lossless: numbersSurviveRewrite(source) };
  } catch {
    return { kind: JimSettingsIssueKinds.Invalid };
  }
}

function missingConfig(path: string): ConfigFile | JimSettingsIssue {
  try {
    lstatSync(path);
    return { kind: JimSettingsIssueKinds.Read };
  } catch (cause) {
    return cause instanceof Error && 'code' in cause && cause.code === MISSING_FILE_CODE
      ? { document: {}, mode: CONFIG_CREATE_MODE, path, lossless: true }
      : { kind: JimSettingsIssueKinds.Read };
  }
}

function validBindings(value: JsonValue | undefined): boolean {
  if (value === undefined) return true;
  return isObject(value) && (
    value['leader'] === undefined ||
    (typeof value['leader'] === 'string' && LeaderKey.from(value['leader']) != null)
  );
}

function leaderFromDocument(document: JsonObject): LeaderKey | undefined {
  const bindings = document['keybindings'];
  return isObject(bindings) && typeof bindings['leader'] === 'string'
    ? LeaderKey.from(bindings['leader'])
    : undefined;
}

function numbersSurviveRewrite(source: string): boolean {
  return Array.from(source.matchAll(JSON_STRING_OR_NUMBER), (match) => match[0])
    .filter((token) => !token.startsWith(JSON_STRING_QUOTE))
    .every((token) => {
      const written = canonicalDecimal(String(Number(token)));
      return written !== undefined && written === canonicalDecimal(token);
    });
}

// Reduces a decimal literal to significant digits and exponent so that
// formatting differences (1.0, 1e0, 10e-1) compare equal but value changes do not.
function canonicalDecimal(literal: string): string | undefined {
  const parts = DECIMAL_PARTS.exec(literal);
  if (parts == null) return undefined;
  const [, sign = '', whole = '', fraction = '', exponent = DECIMAL_ZERO] = parts;
  let digits = `${whole}${fraction}`.replace(LEADING_ZEROS, '');
  let scale = Number(exponent) - fraction.length;
  if (digits.length === 0) return DECIMAL_ZERO;
  while (digits.endsWith(TRAILING_ZERO)) {
    digits = digits.slice(0, -1);
    scale += 1;
  }
  return `${sign}${digits}e${scale}`;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isIssue(value: ConfigFile | JimSettingsIssue): value is JimSettingsIssue {
  return 'kind' in value;
}

function replaceConfig(path: string, source: string, mode: number): JimSettingsIssue | undefined {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let created = false;
  try {
    const descriptor = openSync(temporary, 'wx', mode);
    created = true;
    try {
      // openSync applies the process umask; restore the existing file's mode.
      fchmodSync(descriptor, mode & PERMISSION_BITS);
      writeFileSync(descriptor, source, CONFIG_ENCODING);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
    return undefined;
  } catch (cause) {
    return { kind: JimSettingsIssueKinds.Write, detail: cause instanceof Error ? cause.message : undefined };
  } finally {
    if (created) {
      try { unlinkSync(temporary); } catch { /* Renamed or already removed. */ }
    }
  }
}

