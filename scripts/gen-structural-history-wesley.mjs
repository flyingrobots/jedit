#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const WESLEY_CLI_CRATE = 'wesley-cli';
const WESLEY_CLI_VERSION = '0.0.4';
const SUCCESS_STATUS = 0;
const FAILURE_STATUS = 1;
const REPO_ROOT = process.cwd();
const CACHE_ROOT = join(REPO_ROOT, '.wesley-cache');
const CARGO_ROOT = join(CACHE_ROOT, 'cargo');
const WESLEY_BIN = join(CARGO_ROOT, 'bin', 'wesley');
const STRUCTURAL_HISTORY_SCHEMA = join(REPO_ROOT, 'contracts', 'jedit', 'structural-history.graphql');
const FULL_TYPESCRIPT_OUTPUT = join(CACHE_ROOT, 'structural-history.wesley.generated.ts');
const REPLACE_TEXT_RANGE_OUTPUT = join(
  REPO_ROOT,
  'src',
  'generated',
  'jedit',
  'structural-history-replace-text-range.wesley.generated.ts',
);
const REPLACE_TEXT_RANGE_OPERATION = 'mutationReplaceTextRangeOperation';

main();

function main() {
  mkdirSync(CACHE_ROOT, { recursive: true });
  mkdirSync(dirname(REPLACE_TEXT_RANGE_OUTPUT), { recursive: true });
  ensureWesleyCli();
  emitStructuralHistoryTypescript();
  writeReplaceTextRangeDescriptor();
}

function ensureWesleyCli() {
  if (installedWesleyVersion() === WESLEY_CLI_VERSION) {
    return;
  }

  const install = spawnSync(
    'cargo',
    ['install', WESLEY_CLI_CRATE, '--version', WESLEY_CLI_VERSION, '--root', CARGO_ROOT, '--force'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
    },
  );

  exitOnFailure(install, `failed to install ${WESLEY_CLI_CRATE} ${WESLEY_CLI_VERSION}`);
}

function installedWesleyVersion() {
  if (!existsSync(WESLEY_BIN)) {
    return undefined;
  }

  const version = spawnSync(WESLEY_BIN, ['--version'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (version.status !== SUCCESS_STATUS) {
    return undefined;
  }

  return version.stdout.trim();
}

function emitStructuralHistoryTypescript() {
  const emit = spawnSync(
    WESLEY_BIN,
    ['emit', 'typescript', '--schema', STRUCTURAL_HISTORY_SCHEMA, '--out', FULL_TYPESCRIPT_OUTPUT],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
    },
  );

  exitOnFailure(emit, 'failed to emit structural history Wesley TypeScript');
}

function writeReplaceTextRangeDescriptor() {
  const generated = readFileSync(FULL_TYPESCRIPT_OUTPUT, 'utf8');
  const descriptor = extractOperationDescriptor(generated);
  writeFileSync(REPLACE_TEXT_RANGE_OUTPUT, descriptor);
}

function extractOperationDescriptor(generated) {
  const pattern = new RegExp(
    `export const ${REPLACE_TEXT_RANGE_OPERATION} = [\\s\\S]*?} as const;`,
  );
  const match = generated.match(pattern);

  if (match == null) {
    process.stderr.write(`Wesley output did not include ${REPLACE_TEXT_RANGE_OPERATION}.\n`);
    process.exit(FAILURE_STATUS);
  }

  return [
    '/* @generated from contracts/jedit/structural-history.graphql. Do not edit. */',
    '',
    match[0],
    '',
  ].join('\n');
}

function exitOnFailure(result, message) {
  if (result.status === SUCCESS_STATUS) {
    return;
  }

  if (result.error != null) {
    process.stderr.write(`${result.error.message}\n`);
  }
  process.stderr.write(`${message}.\n`);
  process.exit(result.status ?? FAILURE_STATUS);
}
