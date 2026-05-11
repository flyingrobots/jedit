#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WESLEY_ROOT_ENV = 'JEDIT_WESLEY_ROOT';
const HOST_NODE_TOOL = 'host-node';
const CLI_TOOL = 'cli';
const WESLEY_HOST_ENTRY = ['packages', 'wesley-host-node', 'bin', 'wesley.mjs'];
const WESLEY_CLI_MANIFEST = ['crates', 'wesley-cli', 'Cargo.toml'];
const SUCCESS_STATUS = 0;
const FAILURE_STATUS = 1;

const [tool, ...toolArgs] = process.argv.slice(2);
const wesleyRootInput = process.env[WESLEY_ROOT_ENV];

if (wesleyRootInput == null || wesleyRootInput.trim().length === 0) {
  process.stderr.write(`Set ${WESLEY_ROOT_ENV} to a Wesley checkout before running jedit codegen.\n`);
  process.exit(FAILURE_STATUS);
}

const wesleyRoot = resolve(wesleyRootInput);

if (tool === HOST_NODE_TOOL) {
  runNodeTool(join(wesleyRoot, ...WESLEY_HOST_ENTRY), toolArgs);
} else if (tool === CLI_TOOL) {
  runCargoTool(join(wesleyRoot, ...WESLEY_CLI_MANIFEST), toolArgs);
} else {
  process.stderr.write(`Usage: node scripts/run-wesley-tool.mjs ${HOST_NODE_TOOL}|${CLI_TOOL} [...args]\n`);
  process.exit(FAILURE_STATUS);
}

function runNodeTool(entryPath, args) {
  if (!existsSync(entryPath)) {
    process.stderr.write(`Wesley host entry not found: ${entryPath}\n`);
    process.exit(FAILURE_STATUS);
  }

  exitWith(spawnSync(process.execPath, [entryPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }));
}

function runCargoTool(manifestPath, args) {
  if (!existsSync(manifestPath)) {
    process.stderr.write(`Wesley CLI manifest not found: ${manifestPath}\n`);
    process.exit(FAILURE_STATUS);
  }

  exitWith(spawnSync('cargo', ['run', '--quiet', '--manifest-path', manifestPath, '--', ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }));
}

function exitWith(result) {
  if (result.error != null) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(FAILURE_STATUS);
  }

  process.exit(result.status ?? SUCCESS_STATUS);
}
