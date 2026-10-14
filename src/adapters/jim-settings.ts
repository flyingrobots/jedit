import { closeSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LeaderKey } from '../app/leader-key.js';
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
type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
interface JsonObject { [key: string]: JsonValue }
interface ConfigFile { readonly document: JsonObject; readonly mode: number; readonly path: string }

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
    return { document: value, mode, path: resolvedPath };
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
      ? { document: {}, mode: CONFIG_CREATE_MODE, path }
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

