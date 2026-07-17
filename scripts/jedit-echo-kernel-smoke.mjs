#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ECHO_WASM_MODULE = '@flyingrobots/jedit-echo-wasm';
const ECHO_WASM_MODULE_ENV = 'JEDIT_ECHO_WASM_MODULE';
const JSON_OPTION = '--json';
const MODULE_OPTION = '--module';
const DIST_TRANSPORT_PATH = path.resolve('dist/adapters/echo-wasm-kernel.js');

const options = parseOptions(process.argv.slice(2));
const moduleSpecifier = options.moduleSpecifier
  ?? process.env[ECHO_WASM_MODULE_ENV]
  ?? DEFAULT_ECHO_WASM_MODULE;

try {
  const transportModule = await import(pathToFileURL(DIST_TRANSPORT_PATH).href);
  const echo = await transportModule.createEchoWasmKernelHostTransport({ moduleSpecifier });
  const schedulerStatus = echo.app.schedulerStatusBytes();
  const report = {
    ok: true,
    kernel: echo.app.kernelInfo(),
    schedulerStatusByteLength: schedulerStatus.length,
  };
  emit(options, report);
} catch (error) {
  const report = {
    ok: false,
    moduleSpecifier,
    operation: typeof error?.operation === 'string' ? error.operation : 'kernel-smoke',
    message: error instanceof Error ? error.message : String(error),
  };
  emit(options, report);
  process.exitCode = 1;
}

function parseOptions(args) {
  const options = { json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === JSON_OPTION) {
      options.json = true;
      continue;
    }
    if (arg === MODULE_OPTION) {
      const value = args[index + 1];
      if (value == null || value.startsWith('--')) {
        process.stderr.write(`missing value for ${MODULE_OPTION}\n`);
        process.exit(2);
      }
      options.moduleSpecifier = value;
      index += 1;
      continue;
    }
    process.stderr.write(`unknown argument: ${arg}\n`);
    process.exit(2);
  }
  return options;
}

function emit(options, report) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const message = report.ok
    ? `Echo kernel initialized: ${report.kernel.moduleSpecifier}`
    : `Echo kernel unavailable: ${report.message}`;
  process.stdout.write(`${message}\n`);
}
