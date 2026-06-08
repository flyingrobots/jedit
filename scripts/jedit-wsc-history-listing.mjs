#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

try {
  const options = parseArgs(process.argv.slice(2));
  const [adapter, listing, ports] = await Promise.all([
    importDist('adapters', 'jedit-wsc-workspace-store.js'),
    importDist('app', 'jedit-wsc-history-listing.js'),
    importDist('ports', 'jedit-wsc-history-listing.js'),
  ]);
  const store = adapter.createNodeJeditWscWorkspaceStore(options.workspaceRoot);
  const result = listing.listJeditWscHistoryEvidence(store);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${listing.renderJeditWscHistoryListingLines(result).join('\n')}\n`);
  }
  if (result.status === ports.JEDIT_WSC_HISTORY_LIST_OBSTRUCTED) {
    process.exitCode = 1;
  }
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(`jedit WSC history listing failed: ${message}\n`);
  process.stderr.write(usage());
  process.exitCode = 1;
}

async function importDist(...parts) {
  return import(pathToFileURL(path.join(REPO_ROOT, 'dist', ...parts)).href);
}

function parseArgs(args) {
  let workspaceRoot = process.cwd();
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--workspace') {
      const value = args[index + 1];
      if (value == null || value.startsWith('-')) {
        throw new Error('--workspace requires a path');
      }
      workspaceRoot = path.resolve(value);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return { workspaceRoot, json };
}

function usage() {
  return `Usage: node scripts/jedit-wsc-history-listing.mjs [--workspace path] [--json]\n`;
}
