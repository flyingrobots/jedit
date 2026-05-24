#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const OPTION_SAMPLE_FORBIDDEN_FILE = '--sample-forbidden-file';
const DEFAULT_PRODUCTION_FILES = Object.freeze([
  'src/app/workspace/production-text-session.ts',
  'src/app/workspace/production-text-session-witness.ts',
  'src/adapters/text-runtime-profile-session.ts',
]);
const REMOVED_TRANSITIONAL_FILES = Object.freeze([
  'src/app/interactive-text-runtime-mode.ts',
  'src/adapters/interactive-echo-text-session.ts',
]);
const FORBIDDEN_PATTERNS = Object.freeze([
  'loadEditor',
  'saveEditor',
  'updateInsertMode',
  'updateNormalMode',
  'editor.lines',
  'requestStart',
  'requestRunUntilIdle',
  'requestStop',
  'interactiveTextRuntimeMode',
  'InteractiveTextRuntimeMode',
  'INTERACTIVE_TEXT_RUNTIME',
]);

const options = parseArgs(process.argv.slice(2));
const failures = [
  ...removedFileFailures(),
  ...forbiddenSourceFailures(DEFAULT_PRODUCTION_FILES),
  ...forbiddenSourceFailures(options.sampleForbiddenFiles),
];

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('jedit production cutover guard ok\n');
}

function parseArgs(args) {
  const options = {
    sampleForbiddenFiles: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === OPTION_SAMPLE_FORBIDDEN_FILE) {
      options.sampleForbiddenFiles.push(requiredValue(args, index, arg));
      index += 1;
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  return options;
}

function requiredValue(args, index, arg) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    process.stderr.write(`missing value for ${arg}\n`);
    process.exit(1);
  }
  return value;
}

function removedFileFailures() {
  return REMOVED_TRANSITIONAL_FILES.flatMap((filePath) => {
    try {
      readFileSync(filePath, 'utf8');
      return [`removed transitional file still exists: ${filePath}`];
    } catch {
      return [];
    }
  });
}

function forbiddenSourceFailures(filePaths) {
  return filePaths.flatMap((filePath) => forbiddenSourceFileFailures(filePath));
}

function forbiddenSourceFileFailures(filePath) {
  const source = readFileSync(filePath, 'utf8');
  return FORBIDDEN_PATTERNS
    .filter((pattern) => source.includes(pattern))
    .map((pattern) => `${filePath}: forbidden production cutover token: ${pattern}`);
}
