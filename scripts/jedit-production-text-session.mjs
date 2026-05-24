#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const DEFAULT_INSERT_TEXT = 'hello Echo';
const OPTION_JSON = '--json';
const OPTION_REPLAY_LOCAL = '--replay-local';
const OPTION_TEXT = '--text';
const DIST_ROOT = 'dist';
const ECHO_HOSTED_PROFILE = 'echoHosted';

const options = parseArgs(process.argv.slice(2));
const modules = await loadModules();

if (options.replayLocal) {
  await writeJson(await modules.witness.compareProductionTextSessionReplay({
    createSession() {
      return createProductionSession(modules);
    },
  }, {
    insertText: options.text,
  }));
} else {
  await writeJson(await modules.witness.runProductionTextSessionWitness({
    session: createProductionSession(modules),
    insertText: options.text,
  }));
}

function parseArgs(args) {
  const options = {
    json: false,
    replayLocal: false,
    text: DEFAULT_INSERT_TEXT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === OPTION_JSON) {
      options.json = true;
    } else if (arg === OPTION_REPLAY_LOCAL) {
      options.replayLocal = true;
    } else if (arg === OPTION_TEXT) {
      options.text = requiredValue(args, index, arg);
      index += 1;
    } else {
      throwUsage(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function requiredValue(args, index, arg) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    throwUsage(`missing value for ${arg}`);
  }
  return value;
}

function throwUsage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write('Usage: node scripts/jedit-production-text-session.mjs [--json] [--replay-local] [--text value]\n');
  process.exit(1);
}

function createProductionSession(modules) {
  const binding = modules.adapter.createTextRuntimeProfileSession({
    profile: ECHO_HOSTED_PROFILE,
  });
  return modules.session.createProductionTextSession(binding.session);
}

async function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function loadModules() {
  const [witness, session, adapter] = await Promise.all([
    importDist('app/workspace/production-text-session-witness.js'),
    importDist('app/workspace/production-text-session.js'),
    importDist('adapters/text-runtime-profile-session.js'),
  ]);
  return { witness, session, adapter };
}

async function importDist(specifier) {
  return import(pathToFileURL(path.join(process.cwd(), DIST_ROOT, specifier)).href);
}
