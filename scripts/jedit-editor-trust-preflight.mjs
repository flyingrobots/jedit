#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST_ROOT = 'dist';
const MODULE_PATH = 'app/workspace/editor-trust-preflight.js';
const OPTION_JSON = '--json';
const OPTION_HELP = '--help';
const OPTION_HELP_SHORT = '-h';

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  process.stdout.write(helpText());
  process.exit(0);
}
if (options.errorMessage != null) {
  process.stderr.write(`${options.errorMessage}\n`);
  process.stderr.write(helpText());
  process.exit(1);
}

const preflight = await importDist(MODULE_PATH);
const report = preflight.currentEditorTrustPreflightReport();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function parseArgs(args) {
  const options = {
    help: false,
    json: false,
    errorMessage: undefined,
  };

  for (const arg of args) {
    if (arg === OPTION_HELP || arg === OPTION_HELP_SHORT) {
      options.help = true;
    } else if (arg === OPTION_JSON) {
      options.json = true;
    } else {
      return {
        ...options,
        errorMessage: `unknown argument: ${arg}`,
      };
    }
  }

  return options;
}

function helpText() {
  return 'Usage: node scripts/jedit-editor-trust-preflight.mjs [--json]\n';
}

async function importDist(specifier) {
  return import(pathToFileURL(path.join(process.cwd(), DIST_ROOT, specifier)).href);
}
