#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const OPTION_SAMPLE_FORBIDDEN_FILE = '--sample-forbidden-file';
const DEFAULT_PRODUCTION_FILES = Object.freeze([
  'src/app/workspace/production-text-session.ts',
  'src/app/workspace/production-text-session-witness.ts',
  'src/app/workspace/file-tree.ts',
  'src/app/workspace/viewer-content.ts',
  'src/app/workspace/workspace-text-authority.ts',
  'src/app/workspace/workspace-text-commands.ts',
  'src/app/workspace/workspace-text-position.ts',
  'src/app/workspace/workspace-text-results.ts',
  'src/adapters/text-runtime-profile-session.ts',
]);
const REMOVED_TRANSITIONAL_FILES = Object.freeze([
  'src/app/interactive-text-runtime-mode.ts',
  'src/adapters/interactive-echo-text-session.ts',
]);
const FORBIDDEN_PATTERNS = Object.freeze([
  { label: 'loadEditor', pattern: /\bloadEditor\b(?!File)/u },
  { label: 'saveEditor', pattern: /\bsaveEditor\b(?!File)/u },
  { label: 'updateInsertMode', pattern: /\bupdateInsertMode\b/u },
  { label: 'updateNormalMode', pattern: /\bupdateNormalMode\b/u },
  { label: 'editor.lines', pattern: /\beditor\.lines\b/u },
  { label: 'requestStart', pattern: /\brequestStart\b/u },
  { label: 'requestRunUntilIdle', pattern: /\brequestRunUntilIdle\b/u },
  { label: 'requestStop', pattern: /\brequestStop\b/u },
  { label: 'interactiveTextRuntimeMode', pattern: /\binteractiveTextRuntimeMode\b/u },
  { label: 'InteractiveTextRuntimeMode', pattern: /\bInteractiveTextRuntimeMode\b/u },
  { label: 'INTERACTIVE_TEXT_RUNTIME', pattern: /\bINTERACTIVE_TEXT_RUNTIME\b/u },
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
    .filter((entry) => entry.pattern.test(source))
    .map((entry) => `${filePath}: forbidden production cutover token: ${entry.label}`);
}
