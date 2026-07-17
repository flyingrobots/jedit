#!/usr/bin/env node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const JSON_OPTION = '--json';
const DIST_HOST_PATH = path.resolve('dist/adapters/echo-text-contract-host-process.js');
const WITNESS_OPERATION = 'native-echo-text-witness';
const INITIAL_TEXT = 'Echo';
const INSERTED_TEXT = ' remembers';

const options = parseOptions(process.argv.slice(2));
const walDirectory = mkdtempSync(path.join(tmpdir(), 'jedit-echo-host-witness-'));
let host;

try {
  const hostModule = await import(pathToFileURL(DIST_HOST_PATH).href);
  host = hostModule.createEchoTextContractHostProcess({ walDirectory });
  const opened = requireOutcome(
    await host.openBuffer({
      bufferKey: 'witness.txt',
      initialText: INITIAL_TEXT,
      projectionPath: null,
    }),
    'opened',
  );
  const applied = requireOutcome(
    await host.replaceRange({
      bufferId: opened.bufferId,
      startByte: INITIAL_TEXT.length,
      endByte: INITIAL_TEXT.length,
      insertText: INSERTED_TEXT,
    }),
    'applied',
  );
  const observed = requireOutcome(
    await host.observeWindow({
      bufferId: opened.bufferId,
      basisHeadId: applied.headId,
      startByte: 0,
      endByte: applied.byteLength,
      maxBytes: applied.byteLength,
    }),
    'observed',
  );
  emit(options, successReport(opened, applied, observed));
} catch (error) {
  emit(options, {
    ok: false,
    operation: WITNESS_OPERATION,
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  await host?.close?.();
  rmSync(walDirectory, { recursive: true, force: true });
}

function parseOptions(args) {
  const options = { json: false };
  for (const arg of args) {
    if (arg === JSON_OPTION) {
      options.json = true;
      continue;
    }
    process.stderr.write(`unknown argument: ${arg}\n`);
    process.exit(2);
  }
  return options;
}

function requireOutcome(outcome, expectedKind) {
  if (outcome.kind === 'obstructed') {
    throw new Error(`${outcome.code}: ${outcome.message}`);
  }
  if (outcome.kind !== expectedKind) {
    throw new Error(`expected ${expectedKind}, received ${outcome.kind}`);
  }
  return outcome;
}

function successReport(opened, applied, observed) {
  return {
    ok: true,
    corridor: 'graphql-wesley-installed-contract',
    operation: 'replaceRangeAsTick',
    bufferId: opened.bufferId,
    initialHeadId: opened.headId,
    headId: applied.headId,
    createReceiptId: opened.receiptId,
    createTickId: opened.admittedTickId,
    replaceReceiptId: applied.receiptId,
    replaceTickId: applied.admittedTickId,
    worldlineId: observed.worldlineId,
    readingId: observed.readingId,
    observerPlanId: observed.observerPlanId,
    packageArtifactHash: observed.packageArtifactHash,
    resolvedWorldlineTick: observed.resolvedWorldlineTick,
    commitHash: observed.commitHash,
    supportCount: observed.support.length,
    text: observed.text,
  };
}

function emit(options, report) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const message = report.ok
    ? `Echo applied ${report.operation} at ${report.replaceTickId}`
    : `Echo witness failed: ${report.message}`;
  process.stdout.write(`${message}\n`);
}
