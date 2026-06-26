#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST_ROOT = 'dist';
const MODULE_PATH = 'app/workspace/editor-trust-preflight.js';
const PROBE_MODULE_PATH = 'app/workspace/editor-trust-preflight-runtime-probe.js';
const OPTION_JSON = '--json';
const OPTION_HELP = '--help';
const OPTION_HELP_SHORT = '-h';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const REQUIRED_DIST_MODULES = Object.freeze([
  MODULE_PATH,
  PROBE_MODULE_PATH,
]);

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
if (!options.json) {
  process.stderr.write('error: --json is required\n');
  process.stderr.write(helpText());
  process.exit(1);
}

const distIssue = missingDistIssue();
if (distIssue != null) {
  process.stderr.write(`${distIssue}; run npm run build\n`);
  process.exit(1);
}

const [preflight, runtimeProbe] = await Promise.all([
  importDist(MODULE_PATH),
  importDist(PROBE_MODULE_PATH),
]);
const reporter = preflight.createEditorTrustPreflightReporter(
  runtimeProbe.createEditorTrustPreflightRuntimeProbe(),
);
const report = await reporter.currentReport();
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
  return 'Usage: node scripts/jedit-editor-trust-preflight.mjs --json\n';
}

async function importDist(specifier) {
  return import(pathToFileURL(path.join(REPO_ROOT, DIST_ROOT, specifier)).href);
}

function missingDistIssue() {
  const distPath = path.join(REPO_ROOT, DIST_ROOT);
  if (!existsSync(distPath)) {
    return 'dist not found';
  }

  for (const modulePath of REQUIRED_DIST_MODULES) {
    if (!existsSync(path.join(REPO_ROOT, DIST_ROOT, modulePath))) {
      return `dist module missing: ${modulePath}`;
    }
  }

  return undefined;
}
