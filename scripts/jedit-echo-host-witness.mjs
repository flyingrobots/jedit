#!/usr/bin/env node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  EchoTextHostCheckpointReasons,
  EchoTextHostOperationNames,
  EchoTextHostOutcomeKinds,
} from '../dist/ports/echo-text-contract-host.js';

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
    EchoTextHostOutcomeKinds.Opened,
  );
  const applied = requireOutcome(
    await host.replaceRange({
      bufferId: opened.bufferId,
      startByte: INITIAL_TEXT.length,
      endByte: INITIAL_TEXT.length,
      insertText: INSERTED_TEXT,
    }),
    EchoTextHostOutcomeKinds.Applied,
  );
  const checkpoint = requireOutcome(
    await host.declareCheckpoint({
      bufferId: opened.bufferId,
      basisHeadId: applied.headId,
      reason: EchoTextHostCheckpointReasons.ManualSave,
    }),
    EchoTextHostOutcomeKinds.CheckpointDeclared,
  );
  const observed = requireOutcome(
    await host.observeWindow({
      bufferId: opened.bufferId,
      basisHeadId: applied.headId,
      startByte: 0,
      endByte: applied.byteLength,
      maxBytes: applied.byteLength,
    }),
    EchoTextHostOutcomeKinds.Observed,
  );
  emit(options, successReport(opened, applied, checkpoint, observed));
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
  if (outcome.kind === EchoTextHostOutcomeKinds.Obstructed) {
    throw new Error(`${outcome.code}: ${outcome.message}`);
  }
  if (outcome.kind !== expectedKind) {
    throw new Error(`expected ${expectedKind}, received ${outcome.kind}`);
  }
  return outcome;
}

function successReport(opened, applied, checkpoint, observed) {
  return {
    ok: true,
    corridor: 'graphql-wesley-installed-contract',
    operation: EchoTextHostOperationNames.ReplaceRangeAsTick,
    bufferId: opened.bufferId,
    initialHeadId: opened.headId,
    headId: applied.headId,
    createReceiptId: opened.receiptId,
    createTickId: opened.admittedTickId,
    replaceReceiptId: applied.receiptId,
    replaceTickId: applied.admittedTickId,
    checkpointOperation: EchoTextHostOperationNames.DeclareCheckpoint,
    checkpointId: checkpoint.checkpointId,
    checkpointBasisHeadId: checkpoint.basisHeadId,
    checkpointBasisByteLength: checkpoint.basisByteLength,
    checkpointReason: checkpoint.reason,
    checkpointReceiptId: checkpoint.receiptId,
    checkpointTickId: checkpoint.admittedTickId,
    checkpointHeadId: checkpoint.headId,
    checkpointRootNodeId: checkpoint.rootNodeId,
    checkpointByteLength: checkpoint.byteLength,
    checkpointLineCount: checkpoint.lineCount,
    checkpointBufferVersion: checkpoint.bufferVersion,
    appliedRootNodeId: applied.rootNodeId,
    appliedByteLength: applied.byteLength,
    appliedLineCount: applied.lineCount,
    appliedBufferVersion: applied.bufferVersion,
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
    ? `Echo applied ${report.operation} and ${report.checkpointOperation} at ${report.checkpointTickId}`
    : `Echo witness failed: ${report.message}`;
  process.stdout.write(`${message}\n`);
}
